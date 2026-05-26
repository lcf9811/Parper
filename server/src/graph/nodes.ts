import { AIMessage, SystemMessage, HumanMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { StructuredTool } from '@langchain/core/tools';
import { AgentStateType } from './state.js';
import { providerService } from '../services/providerService.js';
import { skillRegistry } from '../services/skillRegistry.js';
import { executionService } from '../services/executionService.js';
import { knowledgeService } from '../services/knowledgeService.js';
import { ProviderModel } from '../models/providerModel.js';

/**
 * 创建 Agent 节点
 * 负责：加载 skills → 注入 knowledge → 调用 LLM
 */
export function createAgentNode(tools: StructuredTool[]) {
  return async (state: AgentStateType) => {
    const startTime = Date.now();

    // 1. 构建 system prompt（基于选中的 skills + 可用工具）
    const toolInfo = tools.map(t => ({ name: t.name, description: t.description }));
    const systemPrompt = await skillRegistry.buildSystemPrompt(state.selectedSkills, toolInfo);

    // 2. 注入知识上下文
    let fullPrompt = systemPrompt;
    if (state.knowledgeContext.length > 0) {
      fullPrompt += '\n\n## 参考知识\n以下是从知识库中检索到的相关内容，请在回答时参考：\n\n';
      fullPrompt += state.knowledgeContext.join('\n\n---\n\n');
    }

    // 3. 获取 LLM 实例并绑定工具
    const llm = await providerService.getLLMInstance('default');
    const llmWithTools = tools.length > 0 ? llm.bindTools(tools, { tool_choice: 'auto' }) : llm;

    // KR-03: 空知识检索时，在 system prompt 中明确告知 LLM
    if (state.knowledgeContext.length === 1 && state.knowledgeContext[0].includes('【知识检索】未找到相关内容')) {
      fullPrompt += '\n\n' + state.knowledgeContext[0];
    }

    // 4. 构建消息列表
    const messages = [
      new SystemMessage(fullPrompt),
      ...state.messages,
    ];

    // 5. 调用 LLM（使用 stream 实现真正的流式，BE-14）
    // 注意：某些模型（如 kimi-k2.5）在 stream 模式下，tool_calls 通过 additional_kwargs 增量传递
    const stream = await llmWithTools.stream(messages);
    let content = '';
    let toolCalls: any[] | undefined;
    let rawToolCalls: any[] = []; // 收集 additional_kwargs 中的工具调用（增量更新）
    for await (const chunk of stream) {
      const aiChunk = chunk as AIMessage;
      if (typeof aiChunk.content === 'string') {
        content += aiChunk.content;
      }
      // 收集 additional_kwargs 中的工具调用（kimi-k2.5 等模型在此处增量传递）
      const akToolCalls = (aiChunk as any).additional_kwargs?.tool_calls;
      if (akToolCalls && Array.isArray(akToolCalls)) {
        for (const tc of akToolCalls) {
          rawToolCalls.push(tc);
        }
      }
      // 同时检查 chunk.tool_calls（某些模型直接在此处传递）
      if (aiChunk.tool_calls && aiChunk.tool_calls.length > 0) {
        // 如果 chunk.tool_calls 已经有完整的 args，直接使用
        const hasArgs = aiChunk.tool_calls.some((tc: any) => tc.args && Object.keys(tc.args).length > 0);
        if (hasArgs) {
          toolCalls = aiChunk.tool_calls;
        }
      }
    }
    // 如果 chunk.tool_calls 没有完整参数，从 additional_kwargs 中合并解析
    if (!toolCalls && rawToolCalls.length > 0) {
      const merged: Record<string, any> = {};
      for (const tc of rawToolCalls) {
        const idx = tc.index ?? 0;
        if (!merged[idx]) {
          merged[idx] = { id: '', name: '', args: '', type: tc.type || 'tool_call' };
        }
        if (tc.id) merged[idx].id = tc.id;
        if (tc.function?.name) merged[idx].name = tc.function.name;
        if (tc.function?.arguments) merged[idx].args += tc.function.arguments;
        if (tc.name) merged[idx].name = tc.name;
        if (tc.args && typeof tc.args === 'object') merged[idx].args = tc.args;
      }
      toolCalls = Object.values(merged).map(tc => {
        const parsed: any = { name: tc.name, args: {}, type: tc.type || 'tool_call', id: tc.id };
        if (typeof tc.args === 'string' && tc.args) {
          try { parsed.args = JSON.parse(tc.args); } catch { parsed.args = {}; }
        } else if (typeof tc.args === 'object') {
          parsed.args = tc.args;
        }
        return parsed;
      });
    }
    const response = new AIMessage({ content, tool_calls: toolCalls });

    // 6. 记录执行步骤
    const durationMs = Date.now() - startTime;
    if (state.executionId) {
      await executionService.addStep(state.executionId, {
        type: 'llm_call',
        name: 'agent_node',
        input: { messageCount: state.messages.length, skills: state.selectedSkills },
        output: {
          hasToolCalls: (toolCalls?.length ?? 0) > 0,
          contentLength: content.length,
        },
        durationMs,
      });
    }

    return { messages: [response], currentStep: state.currentStep + 1 };
  };
}

/**
 * 创建 Tool 节点
 * 使用 LangGraph 内置的 ToolNode，并包装以记录调用日志
 */
export function createToolNode(tools: StructuredTool[]) {
  const toolNode = new ToolNode(tools);

  return async (state: AgentStateType) => {
    const startTime = Date.now();

    // 执行工具调用
    const result = await toolNode.invoke(state);

    // 记录步骤
    const durationMs = Date.now() - startTime;
    if (state.executionId) {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      const toolCalls = lastMessage?.tool_calls || [];
      await executionService.addStep(state.executionId, {
        type: 'tool_call',
        name: toolCalls.map((tc: any) => tc.name).join(', '),
        input: toolCalls.map((tc: any) => ({ name: tc.name, args: tc.args })),
        output: { resultCount: result.messages?.length || 0 },
        durationMs,
      });
    }

    return { ...result, toolCallCount: state.toolCallCount + 1 };
  };
}

/**
 * 知识检索节点（可选）
 * 在 autoKnowledgeRetrieval 启用时使用
 */
export async function knowledgeRetrievalNode(state: AgentStateType) {
  const startTime = Date.now();

  // 从最后一条用户消息提取查询
  const lastUserMsg = [...state.messages].reverse().find(m => m._getType() === 'human');
  if (!lastUserMsg) return { knowledgeContext: [] };

  const queryText = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '';
  if (!queryText) return { knowledgeContext: [] };

  // ���索知识库
  // KR-06: 读取配置中的 knowledge_top_k
  const lgConfig = await providerService.getLangGraphConfig();
  const topK = lgConfig.knowledge_top_k || 5;
  const chunks = await knowledgeService.search(queryText, topK);
  const context = chunks.map(c => `[${c.doc_title}]\n${c.content}`);

  // 记录步骤
  const durationMs = Date.now() - startTime;
  if (state.executionId) {
    await executionService.addStep(state.executionId, {
      type: 'knowledge_retrieval',
      name: 'knowledge_retrieval',
      input: { query: queryText },
      output: { resultCount: chunks.length },
      durationMs,
    });

    // 更新执行记录中的知识上下文
    await executionService.setKnowledgeContext(state.executionId, context);
  }

  return { knowledgeContext: context };
}
