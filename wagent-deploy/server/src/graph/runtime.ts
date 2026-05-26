import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { buildReactGraph } from './builder.js';
import { providerService } from '../services/providerService.js';
import { sessionService } from '../services/sessionService.js';
import { executionService } from '../services/executionService.js';

export interface ChatInput {
  sessionId: string;
  message: string;
  tools?: string[];
  skills?: string[];
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

  // 2. 保存用户消息
  await sessionService.addMessage(input.sessionId, 'user', input.message);

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
    });

    // 8. 提取回复
    const lastMessage = result.messages[result.messages.length - 1];
    const reply = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

    // 9. 保存助手消息
    await sessionService.addMessage(input.sessionId, 'assistant', reply);

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
