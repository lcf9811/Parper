import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

/**
 * Agent 状态定义
 * LangGraph StateGraph 使用 Annotation 定义状态字段
 */
export const AgentState = Annotation.Root({
  /** 消息历史（LangGraph 自动合并） */
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** 会话 ID */
  sessionId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  /** 执行记录 ID */
  executionId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  /** 用户选中的工具名称列表 */
  selectedTools: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** 用户选中的技能名称列表 */
  selectedSkills: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** 检索到的知识上下文 */
  knowledgeContext: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** 当前步骤索引 */
  currentStep: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
});

export type AgentStateType = typeof AgentState.State;
