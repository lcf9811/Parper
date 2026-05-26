/**
 * Streaming Agent 运行时
 * 支持 SSE 实时事件流
 */
import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from '@langchain/core/messages';
import { buildReactGraph } from './builder.js';
import { providerService } from '../services/providerService.js';
import { sessionService } from '../services/sessionService.js';
import { executionService } from '../services/executionService.js';
import { sseService } from '../services/sseService.js';

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

export interface StreamingChatInput {
  sessionId: string;
  message: string;
  tools?: string[];
  skills?: string[];
  executionId: string;
  skipSaveUserMessage?: boolean; // 如果为 true，不保存用户消息（由调用方保存）
}

export interface StreamingChatOutput {
  reply: string;
  executionId: string;
  sessionId: string;
}

/**
 * 流式 Agent 运行时
 * 在执行过程中通过 SSE 发送实时事件
 */
export async function runAgentStreaming(input: StreamingChatInput): Promise<StreamingChatOutput> {
  const startTime = Date.now();
  const { executionId } = input;

  try {
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

    // 发送输入接收事件
    sseService.emitInput(executionId, input.message);

    // 3. 标记执行记录为运行中
    await executionService.markRunning(executionId);

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

    // 发送开始构建图步骤
    sseService.emitStep(executionId, 'llm_call', '构建执行图', 'running');

    const graph = await buildReactGraph({
      selectedTools,
      autoKnowledgeRetrieval: Boolean(lgConfig.auto_knowledge_retrieval),
      toolLoopEnabled: Boolean(lgConfig.tool_loop_enabled),
    });

    sseService.emitStep(executionId, 'llm_call', '构建执行图', 'completed', {
      toolsCount: selectedTools.length,
      skillsCount: selectedSkills.length,
    });

    // 7. 执行图 - 使用流式模式
    sseService.emitStep(executionId, 'llm_call', '分析用户意图', 'running');

    const historyLength = history.length;

    const stream = await graph.streamEvents(
      {
        messages: [...history, new HumanMessage(input.message)],
        sessionId: input.sessionId,
        executionId: executionId,
        selectedTools,
        selectedSkills,
        knowledgeContext: [],
        currentStep: 0,
        toolCallCount: 0,
        maxToolCalls: 10,
      },
      { version: 'v2' }
    );

    let fullContent = '';
    let hasSentFirstChunk = false;
    let lastAiToolCalls: any = undefined; // 用于保存 assistant 的 tool_calls
    const toolMessagesToSave: Array<{ content: string; tool_call_id: string }> = []; // 用于保存 tool 消息

    // 处理流式事件
    for await (const event of stream) {
      try {
        const { event: eventType, data, name } = event;

      // 处理模型输出事件
      if (eventType === 'on_chat_model_stream') {
        const chunk = data?.chunk;
        if (chunk?.content) {
          const content = extractContentText(chunk.content);
          
          if (content) {
            // 首次收到内容时，标记分析步骤完成
            if (!hasSentFirstChunk) {
              sseService.emitStep(executionId, 'llm_call', '分析用户意图', 'completed');
              sseService.emitStep(executionId, 'llm_call', '生成回复', 'running');
              hasSentFirstChunk = true;
            }

            fullContent += content;
            // 发送部分输出
            sseService.emitOutput(executionId, content, true);
          }
        }
      }

      // 处理工具调用事件
      if (eventType === 'on_tool_start') {
        sseService.emitStep(executionId, 'tool_call', `调用工具: ${name}`, 'running', {
          toolName: name,
          input: data?.input,
        });
      }

      if (eventType === 'on_tool_end') {
        sseService.emitStep(executionId, 'tool_call', `调用工具: ${name}`, 'completed', {
          toolName: name,
          output: data?.output,
        });
      }

      // 处理知识检索事件
      if (eventType === 'on_retriever_start') {
        sseService.emitStep(executionId, 'knowledge_retrieval', '检索相关知识', 'running');
      }

      if (eventType === 'on_retriever_end') {
        const docs = data?.output?.documents || [];
        sseService.emitStep(executionId, 'knowledge_retrieval', '检索相关知识', 'completed', {
          documentsCount: docs.length,
        });
      }

      // 兜底：图执行完成时从最终状态提取回复（agent 节点内部使用 invoke，不产生 on_chat_model_stream）
      if (eventType === 'on_chain_end' && !name?.includes('Channel') && data?.output?.messages) {
        const msgs = data.output.messages;
        const initialCount = historyLength + 1;
        const newMsgs = msgs.slice(initialCount);

        // BE-05/BE-07: 提取最终回复时，优先找 tool 消息之后的 assistant 消息（自然语言总结）
        const lastToolIndex = newMsgs.map((m: any) => m._getType?.() || m.type).lastIndexOf('tool');
        const candidateMsgs = lastToolIndex >= 0 ? newMsgs.slice(lastToolIndex + 1) : newMsgs;
        const lastAiMsg = candidateMsgs.filter((m: any) => m._getType?.() === 'ai' || m.type === 'ai').pop();
        const lastMsg = lastAiMsg || newMsgs[newMsgs.length - 1] || msgs[msgs.length - 1];

        if (lastMsg && !fullContent) {
          const finalContent = extractContentText(lastMsg.content);
          fullContent = finalContent;
        }
        // 提取本轮所有 assistant 消息的 tool_calls（取最后一条带 tool_calls 的）
        const aiMsgs = newMsgs.filter((m: any) => m._getType?.() === 'ai' || m.type === 'ai');
        for (const aiMsg of aiMsgs) {
          if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
            lastAiToolCalls = aiMsg.tool_calls;
          }
        }
        // 收集本轮所有 tool 消息用于持久化
        const tMsgs = newMsgs.filter((m: any) => m._getType?.() === 'tool' || m.type === 'tool');
        for (const tm of tMsgs) {
          const tId = tm.tool_call_id || '';
          toolMessagesToSave.push({ content: extractContentText(tm.content), tool_call_id: tId });
        }
      }
      } catch (eventErr: any) {
        console.error('[Streaming] 处理单个事件时出错:', eventErr);
        sseService.emitError(executionId, eventErr.message || '事件处理错误');
      }
    }

    // 兜底：如果通过 on_chain_end 获取到内容，补发步骤事件
    if (fullContent && !hasSentFirstChunk) {
      sseService.emitStep(executionId, 'llm_call', '分析用户意图', 'completed');
      sseService.emitStep(executionId, 'llm_call', '生成回复', 'running');
      hasSentFirstChunk = true;
    }

    // 标记生成完成
    sseService.emitStep(executionId, 'llm_call', '生成回复', 'completed');

    // 8. 提取最终回复
    const reply = fullContent || '抱歉，我没有生成任何回复。';

    // 发送最终完整输出
    sseService.emitOutput(executionId, reply, false);

    // 9. 保存助手消息（包含 tool_calls）
    await sessionService.addMessage(input.sessionId, 'assistant', reply, lastAiToolCalls);

    // 9.1 保存所有工具消息（用于历史重建）
    for (const tMsg of toolMessagesToSave) {
      await sessionService.addMessage(input.sessionId, 'tool', tMsg.content, tMsg.tool_call_id ? { tool_call_id: tMsg.tool_call_id } : undefined);
    }

    // 10. 完成执行
    const durationMs = Date.now() - startTime;
    await executionService.complete(executionId, reply, durationMs);

    // 发送完成事件
    sseService.emitComplete(executionId, 'done', {
      reply,
      durationMs,
    });

    return {
      reply,
      executionId,
      sessionId: input.sessionId,
    };
  } catch (err: any) {
    // 记录执行失败
    const durationMs = Date.now() - startTime;
    await executionService.fail(executionId, err.message || String(err), durationMs);

    // 发送错误事件
    sseService.emitError(executionId, err.message || '未知错误');
    sseService.emitComplete(executionId, 'error', {
      error: err.message || '未知错误',
    });

    // 保存错误消息
    const errorReply = `抱歉，处理过程中出现错误：${err.message || '未知错误'}`;
    await sessionService.addMessage(input.sessionId, 'assistant', errorReply);

    return {
      reply: errorReply,
      executionId,
      sessionId: input.sessionId,
    };
  } finally {
    // 注意：不再在此关闭 SSE 连接。
    // SSE 连接由 GET /api/chat/stream/:executionId 路由管理器负责关闭，
    // 避免与路由器的 polling 循环产生竞态条件。
  }
}
