import { query } from '../config/database.js';
import crypto from 'crypto';

export interface Skill {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  system_prompt: string;
  file_path: string | null;
  tags: string[] | null;
  enabled: boolean;
  built_in: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SkillInput {
  name: string;
  display_name: string;
  description?: string;
  system_prompt: string;
  tags?: string[];
}

export const SkillModel = {
  async findAll(): Promise<Skill[]> {
    return query<Skill[]>('SELECT * FROM agent_skills ORDER BY name ASC');
  },

  async findEnabled(): Promise<Skill[]> {
    return query<Skill[]>('SELECT * FROM agent_skills WHERE enabled = 1 ORDER BY name ASC');
  },

  async findByName(name: string): Promise<Skill | null> {
    const rows = await query<Skill[]>('SELECT * FROM agent_skills WHERE name = ?', [name]);
    return rows[0] || null;
  },

  async findById(id: string): Promise<Skill | null> {
    const rows = await query<Skill[]>('SELECT * FROM agent_skills WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create(input: SkillInput): Promise<Skill> {
    const id = crypto.randomUUID();
    const tags = input.tags ? JSON.stringify(input.tags) : null;
    await query(
      'INSERT INTO agent_skills (id, name, display_name, description, system_prompt, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [id, input.name, input.display_name, input.description || null, input.system_prompt, tags]
    );
    return (await this.findById(id))!;
  },

  async update(id: string, input: Partial<SkillInput>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
    if (input.display_name !== undefined) { fields.push('display_name = ?'); values.push(input.display_name); }
    if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
    if (input.system_prompt !== undefined) { fields.push('system_prompt = ?'); values.push(input.system_prompt); }
    if (input.tags !== undefined) { fields.push('tags = ?'); values.push(input.tags ? JSON.stringify(input.tags) : null); }
    if (fields.length === 0) return;
    values.push(id);
    await query(`UPDATE agent_skills SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async remove(id: string): Promise<void> {
    await query('DELETE FROM agent_skills WHERE id = ?', [id]);
  },

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    await query('UPDATE agent_skills SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
  },

  async updateFilePath(id: string, filePath: string): Promise<void> {
    await query('UPDATE agent_skills SET file_path = ? WHERE id = ?', [filePath, id]);
  },
};
