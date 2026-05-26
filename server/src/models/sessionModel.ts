import { query } from '../config/database.js';
import crypto from 'crypto';

export interface Session {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export const SessionModel = {
  async findAll(): Promise<Session[]> {
    return query<Session[]>('SELECT * FROM agent_sessions ORDER BY updated_at DESC');
  },

  async findById(id: string): Promise<Session | null> {
    const rows = await query<Session[]>('SELECT * FROM agent_sessions WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create(title?: string): Promise<Session> {
    const id = crypto.randomUUID();
    await query('INSERT INTO agent_sessions (id, title) VALUES (?, ?)', [id, title || '新会话']);
    return (await this.findById(id))!;
  },

  async updateTitle(id: string, title: string): Promise<void> {
    await query('UPDATE agent_sessions SET title = ? WHERE id = ?', [title, id]);
  },

  async remove(id: string): Promise<void> {
    await query('DELETE FROM agent_sessions WHERE id = ?', [id]);
  },
};
