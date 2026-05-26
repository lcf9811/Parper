import { query } from '../config/database.js';
import crypto from 'crypto';

export interface Tool {
  id: string;
  name: string;
  display_name: string;
  description: string;
  parameters_schema: any;
  enabled: boolean;
  built_in: boolean;
  created_at: Date;
  updated_at: Date;
}

export const ToolModel = {
  async findAll(): Promise<Tool[]> {
    return query<Tool[]>('SELECT * FROM agent_tools ORDER BY built_in DESC, name ASC');
  },

  async findEnabled(): Promise<Tool[]> {
    return query<Tool[]>('SELECT * FROM agent_tools WHERE enabled = 1 ORDER BY name ASC');
  },

  async findByName(name: string): Promise<Tool | null> {
    const rows = await query<Tool[]>('SELECT * FROM agent_tools WHERE name = ?', [name]);
    return rows[0] || null;
  },

  async findById(id: string): Promise<Tool | null> {
    const rows = await query<Tool[]>('SELECT * FROM agent_tools WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async upsert(name: string, displayName: string, description: string, parametersSchema: any, builtIn = false): Promise<void> {
    const existing = await this.findByName(name);
    if (existing) {
      await query(
        'UPDATE agent_tools SET display_name = ?, description = ?, parameters_schema = ?, built_in = ? WHERE name = ?',
        [displayName, description, JSON.stringify(parametersSchema), builtIn ? 1 : 0, name]
      );
    } else {
      const id = crypto.randomUUID();
      await query(
        'INSERT INTO agent_tools (id, name, display_name, description, parameters_schema, built_in) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, displayName, description, JSON.stringify(parametersSchema), builtIn ? 1 : 0]
      );
    }
  },

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    await query('UPDATE agent_tools SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
  },

  async findByMcpType(mcpType: string): Promise<Tool[]> {
    // 查找标记为 MCP 类型的工具
    return query<Tool[]>(
      'SELECT * FROM agent_tools WHERE enabled = 1 AND parameters_schema->>"$.mcpType" = ?',
      [mcpType]
    );
  },

  async createMcpTool(
    name: string,
    displayName: string,
    description: string,
    mcpType: string,
    parametersSchema: any,
    endpoint?: string
  ): Promise<Tool> {
    const id = crypto.randomUUID();
    const schema = {
      ...parametersSchema,
      mcpType,
      endpoint,
    };
    
    await query(
      'INSERT INTO agent_tools (id, name, display_name, description, parameters_schema, built_in) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, displayName, description, JSON.stringify(schema), 0]
    );
    
    return (await this.findById(id))!;
  },

  async remove(id: string): Promise<void> {
    await query('DELETE FROM agent_tools WHERE id = ? AND built_in = 0', [id]);
  },
};
