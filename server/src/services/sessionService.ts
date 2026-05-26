import { SessionModel } from '../models/sessionModel.js';
import { MessageModel, Message } from '../models/messageModel.js';
import { providerService } from './providerService.js';

export const sessionService = {
  async listSessions() {
    return SessionModel.findAll();
  },

  async findById(id: string) {
    return SessionModel.findById(id);
  },

  async createSession(title?: string) {
    return SessionModel.create(title);
  },

  async getSession(id: string) {
    return SessionModel.findById(id);
  },

  async updateTitle(id: string, title: string) {
    return SessionModel.updateTitle(id, title);
  },

  /**
   * 自动生成会话标题
   * 使用 LLM 根据第一条消息生成简洁的标题
   */
  async generateTitle(sessionId: string, firstMessage: string): Promise<string> {
    if (!firstMessage || firstMessage.trim().length === 0) {
      return '新会话';
    }

    try {
      const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');
      const llm = await providerService.getLLMInstance('default');
      
      const prompt = `请根据以下用户消息，生成一个简洁的会话标题（不超过20个字符）。
只需返回标题文本，不要有任何解释或标点。

用户消息：${firstMessage.trim().substring(0, 200)}`;

      const response = await llm.invoke([
        new SystemMessage('你是一个标题生成助手。根据用户消息生成简洁的中文标题。'),
        new HumanMessage(prompt)
      ]);

      const title = typeof response.content === 'string' 
        ? response.content.trim().substring(0, 30)
        : '新会话';

      // 更新数据库
      await SessionModel.updateTitle(sessionId, title);
      
      return title || '新会话';
    } catch (error) {
      console.error('[SessionService] Failed to generate title:', error);
      // 降级：使用前20个字符作为标题
      const fallbackTitle = firstMessage.trim().substring(0, 20);
      await SessionModel.updateTitle(sessionId, fallbackTitle);
      return fallbackTitle;
    }
  },

  async getMessages(sessionId: string, limit?: number) {
    return MessageModel.findBySession(sessionId, limit);
  },

  async addMessage(sessionId: string, role: Message['role'], content: string | null | undefined, toolCalls?: any, source?: 'user' | 'webhook') {
    // Validate and normalize parameters to prevent undefined values from causing issues
    const normalizedContent = content === undefined ? null : content;
    const normalizedToolCalls = toolCalls === undefined ? null : toolCalls;

    // Log for debugging purposes - helps identify when undefined values are being passed
    if (content === undefined) {
      console.warn(`[SessionService] addMessage received undefined content for session ${sessionId}, role: ${role}. Converting to null.`);
    }
    if (toolCalls === undefined) {
      console.log(`[SessionService] addMessage received undefined toolCalls for session ${sessionId}, role: ${role}. Converting to null.`);
    }

    return MessageModel.create(sessionId, role, normalizedContent, normalizedToolCalls, source);
  },

  async deleteSession(id: string) {
    return SessionModel.remove(id);
  },
};
