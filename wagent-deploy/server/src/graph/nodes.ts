import { AIMessage, SystemMessage, HumanMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { StructuredTool } from '@langchain/core/tools';
import { AgentStateType } from './state.js';
import { providerService } from '../services/providerService.js';
import { skillRegistry } from '../services/skillRegistry.js';
import { executionService } from '../services/executionService.js';
import { knowledgeService } from '../services/knowledgeService.js';

/**
 * 创建 Agent 节点
 * 负责：加载 skills → 注入 knowledge → 调用 LLM
 */
export function createAgentNode(tools: StructuredTool[]) {
  return async (state: AgentStateType) => {
    const startTime = Date.now();

    // 1. 构建 system prompt（基于选中的 skills）
    const systemPrompt = await skillRegistry.buildSystemPrompt(state.selectedSkills);

    // 2. 注入知识上下文
    let fullPrompt = systemPrompt;
    if (state.knowledgeContext.length > 0) {
      fullPrompt += '\n\n## 参考知识\n以下是从知识库中检索到的相关内容，请在回答时参考：\n\n';
      fullPrompt += state.knowledgeContext.join('\n\n---\n\n');
    }

    // 3. 获取 LLM 实例并绑定工具
    const llm = await providerService.getLLMInstance('default');
    const llmWithTools = tools.length > 0 ? llm.bindTools(tools) : llm;

    // 4. 构建消息列表
    const messages = [
      new SystemMessage(fullPrompt),
      ...state.messages,
    ];

    // 5. 调用 LLM
    const response = await llmWithTools.invoke(messages);

    // 6. 记录执行步骤
    const durationMs = Date.now() - startTime;
    if (state.executionId) {
      await executionService.addStep(state.executionId, {
        type: 'llm_call',
        name: 'agent_node',
        input: { messageCount: state.messages.length, skills: state.selectedSkills },
        output: {
          hasToolCalls: (response as AIMessage).tool_calls?.length ?? 0 > 0,
          contentLength: typeof response.content === 'string' ? response.content.length : 0,
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

    return result;
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
  const chunks = await knowledgeService.search(queryText, 5);
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
