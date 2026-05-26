/**
 * 长期记忆模型
 */
import { query } from '../config/database.js';
import crypto from 'crypto';

export type MemoryType = 'fact' | 'preference' | 'summary';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  context: string | null;
  importance: number;
  source_session_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MemoryInput {
  type: MemoryType;
  content: string;
  context?: string;
  importance?: number;
  sourceSessionId?: string;
}

export const MemoryModel = {
  async findAll(type?: MemoryType): Promise<Memory[]> {
    let sql = 'SELECT * FROM memories';
    const params: any[] = [];
    
    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY importance DESC, updated_at DESC';
    return query<Memory[]>(sql, params);
  },

  async findById(id: string): Promise<Memory | null> {
    const rows = await query<Memory[]>('SELECT * FROM memories WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async search(keyword: string): Promise<Memory[]> {
    const rows = await query<Memory[]>(
      'SELECT * FROM memories WHERE MATCH(content, context) AGAINST(? IN NATURAL LANGUAGE MODE) ORDER BY importance DESC',
      [keyword]
    );
    return rows;
  },

  async create(input: MemoryInput): Promise<Memory> {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO memories (id, type, content, context, importance, source_session_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.type,
        input.content,
        input.context || null,
        input.importance || 5,
        input.sourceSessionId || null
      ]
    );
    return (await this.findById(id))!;
  },

  async update(id: string, input: Partial<MemoryInput>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (input.type !== undefined) {
      fields.push('type = ?');
      values.push(input.type);
    }
    if (input.content !== undefined) {
      fields.push('content = ?');
      values.push(input.content);
    }
    if (input.context !== undefined) {
      fields.push('context = ?');
      values.push(input.context);
    }
    if (input.importance !== undefined) {
      fields.push('importance = ?');
      values.push(input.importance);
    }
    
    if (fields.length === 0) return;
    
    values.push(id);
    await query(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async remove(id: string): Promise<void> {
    await query('DELETE FROM memories WHERE id = ?', [id]);
  },
};

export default MemoryModel;
