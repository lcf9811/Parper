import { StateGraph, END } from '@langchain/langgraph';
import { StructuredTool } from '@langchain/core/tools';
import { AIMessage } from '@langchain/core/messages';
import { AgentState } from './state.js';
import { createAgentNode, createToolNode, knowledgeRetrievalNode } from './nodes.js';
import { currentTimeTool } from '../tools/currentTime.js';
import { knowledgeLookupTool } from '../tools/knowledgeLookup.js';
import { skillCatalogTool } from '../tools/skillCatalog.js';
import { execCommandTool } from '../tools/execCommand.js';
import { httpApiTool } from '../tools/httpApi.js';
import { pythonRunnerTool } from '../tools/pythonRunner.js';
import { capabilityLookupTool } from '../tools/capabilityLookup.js';
import { createMcpTool } from '../tools/mcpTool.js';
import { toolRegistry } from '../services/toolRegistry.js';

/** 内置工具映射 */
const BUILT_IN_TOOL_MAP: Record<string, StructuredTool> = {
  current_time: currentTimeTool as unknown as StructuredTool,
  knowledge_lookup: knowledgeLookupTool as unknown as StructuredTool,
  skill_catalog: skillCatalogTool as unknown as StructuredTool,
  exec_command: execCommandTool as unknown as StructuredTool,
  http_api: httpApiTool as unknown as StructuredTool,
  python_runner: pythonRunnerTool as unknown as StructuredTool,
  capability_lookup: capabilityLookupTool as unknown as StructuredTool,
};

/**
 * 根据选中的工具名称获取实际的 StructuredTool 实例
 */
async function resolveTools(selectedToolNames: string[]): Promise<StructuredTool[]> {
  // 获取数据库中启用且被选中的工具
  const dbTools = await toolRegistry.getToolsByNames(selectedToolNames);
  const tools: StructuredTool[] = [];

  for (const dbTool of dbTools) {
    const impl = BUILT_IN_TOOL_MAP[dbTool.name];
    if (impl) {
      tools.push(impl);
    } else if (dbTool.parameters_schema?.mcpType) {
      // MCP 工具动态创建
      const mcpTool = createMcpTool(dbTool.name, {
        mcpType: dbTool.parameters_schema.mcpType,
        description: dbTool.description,
        schema: dbTool.parameters_schema,
        endpoint: dbTool.parameters_schema.endpoint,
      });
      tools.push(mcpTool as unknown as StructuredTool);
    }
  }

  return tools;
}

/**
 * 路由条件：判断是否需要调用工具
 */
function createShouldCallTools(toolLoopEnabled: boolean) {
  return function shouldCallTools(state: typeof AgentState.State): 'tools' | typeof END {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      // 限制最大工具调用次数，防止无限循环
      if (state.toolCallCount >= state.maxToolCalls) {
        console.warn(`[Graph] 工具调用次数已达上限 (${state.maxToolCalls})，强制结束工具循环`);
        return END;
      }
      // BE-03: toolLoopEnabled=false 时，已调用过一次工具后不再继续
      if (!toolLoopEnabled && state.toolCallCount > 0) {
        return END;
      }
      return 'tools';
    }
    return END;
  };
}

export interface BuildGraphOptions {
  selectedTools: string[];
  autoKnowledgeRetrieval: boolean;
  toolLoopEnabled: boolean;
}

/**
 * 构建 react_single_agent 图
 *
 * 流程:
 *   [START] -> (knowledge_retrieval?) -> agent -> tools -> agent -> ... -> [END]
 */
export async function buildReactGraph(options: BuildGraphOptions) {
  // KR-05: autoKnowledgeRetrieval=true 时移除 knowledge_lookup 工具，避免与自动检索重复
  const selectedTools = options.autoKnowledgeRetrieval
    ? options.selectedTools.filter(t => t !== 'knowledge_lookup')
    : options.selectedTools;
  const tools = await resolveTools(selectedTools);

  const agentNode = createAgentNode(tools);
  const toolNode = createToolNode(tools);

  const graph = new StateGraph(AgentState);

  if (options.autoKnowledgeRetrieval) {
    // 启用自动知识检索
    graph
      .addNode('knowledge_retrieval', knowledgeRetrievalNode)
      .addNode('agent', agentNode)
      .addNode('tools', toolNode)
      .addEdge('__start__', 'knowledge_retrieval')
      .addEdge('knowledge_retrieval', 'agent');
  } else {
    graph
      .addNode('agent', agentNode)
      .addNode('tools', toolNode)
      .addEdge('__start__', 'agent');
  }

  // agent -> tools 或 END
  const shouldCallTools = createShouldCallTools(options.toolLoopEnabled);
  graph.addConditionalEdges('agent' as any, shouldCallTools, {
    tools: 'tools' as any,
    [END]: END as any,
  });

  // tools -> agent（总结节点）—— 无论 toolLoopEnabled 如何，都先让 agent 总结工具结果
  graph.addEdge('tools' as any, 'agent' as any);

  return graph.compile();
}
