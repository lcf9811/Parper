import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from '@langchain/core/messages';
import { buildReactGraph } from './builder.js';
import { providerService } from '../services/providerService.js';
import { sessionService } from '../services/sessionService.js';
import { executionService } from '../services/executionService.js';

/**
 * 提取消息内容为纯文本。处理 LangChain content 可能是 string 或 array 的情况。
 */
function extractContentText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object') return block.text || block.value || '';
        return '';
      })
      .join('\n');
  }
  return String(content ?? '');
}

export interface ChatInput {
  sessionId: string;
  message: string;
  tools?: string[];
  skills?: string[];
  skipSaveUserMessage?: boolean; // If true, skip saving the user message (caller already saved it)
}

export interface ChatOutput {
  reply: string;
  executionId: string;
  sessionId: string;
}

/**
 * Agent 运行时
 * 入口函数：接收用户消息 → 创建执行记录 → 构建并执行图 → 返回结果
 */
export async function runAgent(input: ChatInput): Promise<ChatOutput> {
  const startTime = Date.now();

  // 1. 确保会话存在
  let session = await sessionService.getSession(input.sessionId);
  if (!session) {
    session = await sessionService.createSession();
    input.sessionId = session.id;
  }

  // 2. 保存用户消息（除非调用方已保存）
  if (!input.skipSaveUserMessage) {
    await sessionService.addMessage(input.sessionId, 'user', input.message);
  }

  // 3. 创建执行记录
  const execution = await executionService.create(input.sessionId, input.message);
  await executionService.markRunning(execution.id);

  try {
    // 4. 获取 LangGraph 配置
    const lgConfig = await providerService.getLangGraphConfig();

    // 5. 加载历史消息
    const historyMessages = await sessionService.getMessages(
      input.sessionId,
      lgConfig.max_history_messages
    );

    // 构建消息历史（排除最新的用户消息，因为会在 state 中传入）
    const history = historyMessages.slice(0, -1).map(m => {
      if (m.role === 'user') return new HumanMessage(m.content || '');
      if (m.role === 'tool') {
        const toolCalls = m.tool_calls ? (typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls) : m.tool_calls) : [];
        const toolCallId = toolCalls[0]?.id || toolCalls[0]?.tool_call_id || '';
        return new ToolMessage({ content: m.content || '', tool_call_id: toolCallId });
      }
      if (m.role === 'system') return new SystemMessage(m.content || '');
      // assistant 消息：恢复 content 和 tool_calls
      const toolCalls = m.tool_calls ? (typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls) : m.tool_calls) : [];
      if (toolCalls.length > 0) {
        return new AIMessage({ content: m.content || '', tool_calls: toolCalls });
      }
      return new AIMessage(m.content || '');
    });

    // 6. 构建图
    const selectedTools = input.tools || [];
    const selectedSkills = input.skills || [];

    const graph = await buildReactGraph({
      selectedTools,
      autoKnowledgeRetrieval: Boolean(lgConfig.auto_knowledge_retrieval),
      toolLoopEnabled: Boolean(lgConfig.tool_loop_enabled),
    });

    // 7. 执行图
    const result = await graph.invoke({
      messages: [...history, new HumanMessage(input.message)],
      sessionId: input.sessionId,
      executionId: execution.id,
      selectedTools,
      selectedSkills,
      knowledgeContext: [],
      currentStep: 0,
      toolCallCount: 0,
      maxToolCalls: 10,
    });

    // 8. 提取回复（跳过 ToolMessage，找最后一条 assistant/user 消息）
    let lastMessage = result.messages[result.messages.length - 1];
    // 如果最后一条是 ToolMessage，往前找 assistant 消息
    for (let i = result.messages.length - 1; i >= 0; i--) {
      if (result.messages[i]._getType() !== 'tool') {
        lastMessage = result.messages[i];
        break;
      }
    }
    const reply = extractContentText(lastMessage.content);

    // 9. 保存本轮新产生的助手消息（每条都携带自己的 tool_calls）和工具消息
    const initialMessageCount = history.length + 1; // history + 当前用户消息
    const newMessages = result.messages.slice(initialMessageCount);

    for (const aiMsg of newMessages.filter(m => m._getType() === 'ai')) {
      const aiContent = extractContentText(aiMsg.content);
      const aiToolCalls = (aiMsg as any).tool_calls;
      // BE-10: 跳过 content 和 tool_calls 都为空的 assistant 消息
      if ((!aiContent || aiContent.trim() === '') && (!aiToolCalls || aiToolCalls.length === 0)) {
        console.log('[Runtime] 跳过空 assistant 消息');
        continue;
      }
      await sessionService.addMessage(input.sessionId, 'assistant', aiContent || '', aiToolCalls || undefined);
    }

    // 9.1 保存本轮新产生的工具消息（用于历史重建）
    for (const tMsg of newMessages.filter(m => m._getType() === 'tool')) {
      const toolCallId = (tMsg as any).tool_call_id || '';
      const toolContent = extractContentText(tMsg.content);
      await sessionService.addMessage(input.sessionId, 'tool', toolContent || '', toolCallId ? { tool_call_id: toolCallId } : undefined);
    }

    // 10. 完成执行
    const durationMs = Date.now() - startTime;
    await executionService.complete(execution.id, reply, durationMs);

    return {
      reply,
      executionId: execution.id,
      sessionId: input.sessionId,
    };
  } catch (err: any) {
    // 记录执行失败
    const durationMs = Date.now() - startTime;
    await executionService.fail(execution.id, err.message || String(err), durationMs);

    // 保存错误消息
    const errorReply = `抱歉，处理过程中出现错误：${err.message || '未知错误'}`;
    await sessionService.addMessage(input.sessionId, 'assistant', errorReply);

    return {
      reply: errorReply,
      executionId: execution.id,
      sessionId: input.sessionId,
    };
  }
}
