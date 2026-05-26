import { query } from '../config/database.js';
import crypto from 'crypto';

export interface LLMProvider {
  id: string;
  name: string;
  api_base_url: string | null;
  api_key: string | null;
  default_model: string;
  planner_model: string | null;
  reviewer_model: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LangGraphConfig {
  id: number;
  graph_mode: string;
  knowledge_top_k: number;
  max_history_messages: number;
  auto_knowledge_retrieval: boolean;
  tool_loop_enabled: boolean;
  interrupt_before_tools: boolean;
  stream_mode: string;
  updated_at: Date;
}

export const ProviderModel = {
  // ---- LLM Provider ----
  async findAllProviders(): Promise<LLMProvider[]> {
    return query<LLMProvider[]>('SELECT * FROM llm_providers ORDER BY is_active DESC, name ASC');
  },

  async findProviderById(id: string): Promise<LLMProvider | null> {
    const rows = await query<LLMProvider[]>('SELECT * FROM llm_providers WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async getActiveProvider(): Promise<LLMProvider | null> {
    const rows = await query<LLMProvider[]>('SELECT * FROM llm_providers WHERE is_active = 1 LIMIT 1');
    return rows[0] || null;
  },

  async createProvider(name: string, apiBaseUrl?: string, apiKey?: string, defaultModel = 'gpt-4.1-mini'): Promise<LLMProvider> {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO llm_providers (id, name, api_base_url, api_key, default_model) VALUES (?, ?, ?, ?, ?)',
      [id, name, apiBaseUrl || null, apiKey || null, defaultModel]
    );
    return (await this.findProviderById(id))!;
  },

  async updateProvider(id: string, fields: Partial<Omit<LLMProvider, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      values.push(val ?? null);
    }
    if (sets.length === 0) return;
    values.push(id);
    await query(`UPDATE llm_providers SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  async setActiveProvider(id: string): Promise<void> {
    // 先全部取消激活，再激活目标
    await query('UPDATE llm_providers SET is_active = 0');
    await query('UPDATE llm_providers SET is_active = 1 WHERE id = ?', [id]);
  },

  async removeProvider(id: string): Promise<void> {
    await query('DELETE FROM llm_providers WHERE id = ?', [id]);
  },

  // ---- LangGraph Config ----
  async getLangGraphConfig(): Promise<LangGraphConfig> {
    const rows = await query<LangGraphConfig[]>('SELECT * FROM langgraph_config WHERE id = 1');
    if (rows.length === 0) {
      // 自动插入默认行
      await query('INSERT IGNORE INTO langgraph_config (id) VALUES (1)');
      const rows2 = await query<LangGraphConfig[]>('SELECT * FROM langgraph_config WHERE id = 1');
      return rows2[0];
    }
    return rows[0];
  },

  async updateLangGraphConfig(fields: Partial<Omit<LangGraphConfig, 'id' | 'updated_at'>>): Promise<void> {
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
    if (sets.length === 0) return;
    await query(`UPDATE langgraph_config SET ${sets.join(', ')} WHERE id = 1`, values);
  },
};
