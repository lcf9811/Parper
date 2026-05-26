import { query } from '../config/database.js';
import crypto from 'crypto';

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls: any | null;
  created_at: Date;
  source?: 'user' | 'webhook' | null;
}

export const MessageModel = {
  async findBySession(sessionId: string, limit?: number): Promise<Message[]> {
    const sql = limit
      ? 'SELECT * FROM agent_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
      : 'SELECT * FROM agent_messages WHERE session_id = ? ORDER BY created_at ASC';
    const params = limit ? [sessionId, limit] : [sessionId];
    return query<Message[]>(sql, params);
  },

  async create(sessionId: string, role: Message['role'], content: string | null | undefined, toolCalls?: any, source?: 'user' | 'webhook'): Promise<Message> {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO agent_messages (id, session_id, role, content, tool_calls, source) VALUES (?, ?, ?, ?, ?, ?)',
      [id, sessionId, role, content ?? null, toolCalls ? JSON.stringify(toolCalls) : null, source || 'user']
    );
    const rows = await query<Message[]>('SELECT * FROM agent_messages WHERE id = ?', [id]);
    return rows[0];
  },

  async countBySession(sessionId: string): Promise<number> {
    const rows = await query<any[]>('SELECT COUNT(*) as cnt FROM agent_messages WHERE session_id = ?', [sessionId]);
    return rows[0].cnt;
  },
};
