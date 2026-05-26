/**
 * Webhook 端点模型
 */
import { query } from '../config/database.js';
import crypto from 'crypto';

/**
 * 安全的 JSON 解析
 * 处理可能存储为非 JSON 格式的遗留数据
 */
function safeJsonParse(value: any, defaultValue: any = []): any {
  if (!value) return defaultValue;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    // 如果不是 JSON，尝试作为逗号分隔的字符串解析
    if (typeof value === 'string') {
      if (value.includes(',')) {
        return value.split(',').map(s => s.trim()).filter(Boolean);
      }
      // 单值情况
      return value.trim() ? [value.trim()] : defaultValue;
    }
    return defaultValue;
  }
}

export interface WebhookEndpoint {
  id: string;
  session_id: string;
  webhook_url: string;
  bearer_key: string;
  selected_tools: string[];
  selected_skills: string[];
  description: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEndpointInput {
  sessionId: string;
  selectedTools: string[];
  selectedSkills: string[];
  description?: string;
}

/**
 * 生成唯一的 Webhook URL 路径
 */
function generateWebhookPath(): string {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `/webhook/${randomPart}`;
}

/**
 * 生成 Bearer Key
 * 格式: wh_<32位随机字符>
 */
function generateBearerKey(): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `wh_${randomPart}`;
}

export const WebhookEndpointModel = {
  async findAll(): Promise<WebhookEndpoint[]> {
    const rows = await query<WebhookEndpoint[]>('SELECT * FROM webhook_endpoints ORDER BY created_at DESC');
    return rows.map(row => ({
      ...row,
      selected_tools: safeJsonParse(row.selected_tools),
      selected_skills: safeJsonParse(row.selected_skills),
    }));
  },

  async findById(id: string): Promise<WebhookEndpoint | null> {
    const rows = await query<WebhookEndpoint[]>('SELECT * FROM webhook_endpoints WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return {
      ...rows[0],
      selected_tools: safeJsonParse(rows[0].selected_tools),
      selected_skills: safeJsonParse(rows[0].selected_skills),
    };
  },

  async findByBearerKey(bearerKey: string): Promise<WebhookEndpoint | null> {
    const rows = await query<WebhookEndpoint[]>('SELECT * FROM webhook_endpoints WHERE bearer_key = ?', [bearerKey]);
    if (rows.length === 0) return null;
    return {
      ...rows[0],
      selected_tools: safeJsonParse(rows[0].selected_tools),
      selected_skills: safeJsonParse(rows[0].selected_skills),
    };
  },

  async create(input: WebhookEndpointInput): Promise<WebhookEndpoint> {
    const id = crypto.randomUUID();
    const webhookPath = generateWebhookPath();
    const bearerKey = generateBearerKey();
    
    await query(
      `INSERT INTO webhook_endpoints (id, session_id, webhook_url, bearer_key, selected_tools, selected_skills, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.sessionId,
        webhookPath,
        bearerKey,
        JSON.stringify(input.selectedTools || []),
        JSON.stringify(input.selectedSkills || []),
        input.description || null
      ]
    );

    return (await this.findById(id))!;
  },

  async update(id: string, input: Partial<WebhookEndpointInput>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (input.sessionId !== undefined) {
      fields.push('session_id = ?');
      values.push(input.sessionId);
    }
    if (input.selectedTools !== undefined) {
      fields.push('selected_tools = ?');
      values.push(JSON.stringify(input.selectedTools));
    }
    if (input.selectedSkills !== undefined) {
      fields.push('selected_skills = ?');
      values.push(JSON.stringify(input.selectedSkills));
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      values.push(input.description);
    }
    
    if (fields.length === 0) return;
    
    values.push(id);
    await query(`UPDATE webhook_endpoints SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    await query('UPDATE webhook_endpoints SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
  },

  async remove(id: string): Promise<void> {
    await query('DELETE FROM webhook_endpoints WHERE id = ?', [id]);
  },
};

export default WebhookEndpointModel;
