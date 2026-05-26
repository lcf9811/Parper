import { query } from '../config/database.js';
import crypto from 'crypto';

export interface Execution {
  id: string;
  session_id: string;
  input: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  knowledge_context: any;
  output: string | null;
  error: string | null;
  duration_ms: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExecutionStep {
  id: string;
  execution_id: string;
  step_index: number;
  type: 'llm_call' | 'tool_call' | 'knowledge_retrieval';
  name: string | null;
  input: any;
  output: any;
  duration_ms: number | null;
  created_at: Date;
}

export interface StepInput {
  type: ExecutionStep['type'];
  name?: string;
  input?: any;
  output?: any;
  durationMs?: number;
}

export const ExecutionModel = {
  async findAll(limit = 50): Promise<Execution[]> {
    return query<Execution[]>('SELECT * FROM executions ORDER BY created_at DESC LIMIT ?', [limit]);
  },

  async findById(id: string): Promise<Execution | null> {
    const rows = await query<Execution[]>('SELECT * FROM executions WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findBySession(sessionId: string): Promise<Execution[]> {
    return query<Execution[]>(
      'SELECT * FROM executions WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );
  },

  async create(sessionId: string, input: string): Promise<Execution> {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO executions (id, session_id, input, status) VALUES (?, ?, ?, ?)',
      [id, sessionId, input, 'pending']
    );
    return (await this.findById(id))!;
  },

  async updateStatus(id: string, status: Execution['status']): Promise<void> {
    await query('UPDATE executions SET status = ? WHERE id = ?', [status, id]);
  },

  async complete(id: string, output: string, durationMs: number): Promise<void> {
    await query(
      'UPDATE executions SET status = ?, output = ?, duration_ms = ? WHERE id = ?',
      ['completed', output, durationMs, id]
    );
  },

  async fail(id: string, error: string, durationMs: number): Promise<void> {
    await query(
      'UPDATE executions SET status = ?, error = ?, duration_ms = ? WHERE id = ?',
      ['failed', error, durationMs, id]
    );
  },

  async setKnowledgeContext(id: string, context: any): Promise<void> {
    await query('UPDATE executions SET knowledge_context = ? WHERE id = ?', [JSON.stringify(context), id]);
  },

  // ---- 步骤 ----
  async getSteps(executionId: string): Promise<ExecutionStep[]> {
    return query<ExecutionStep[]>(
      'SELECT * FROM execution_steps WHERE execution_id = ? ORDER BY step_index ASC',
      [executionId]
    );
  },

  async getStepCount(executionId: string): Promise<number> {
    const rows = await query<any[]>(
      'SELECT COUNT(*) as cnt FROM execution_steps WHERE execution_id = ?',
      [executionId]
    );
    return rows[0].cnt;
  },

  async addStep(executionId: string, step: StepInput): Promise<ExecutionStep> {
    const id = crypto.randomUUID();
    const stepIndex = await this.getStepCount(executionId);
    await query(
      'INSERT INTO execution_steps (id, execution_id, step_index, type, name, input, output, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, executionId, stepIndex, step.type,
        step.name || null,
        step.input ? JSON.stringify(step.input) : null,
        step.output ? JSON.stringify(step.output) : null,
        step.durationMs || null,
      ]
    );
    const rows = await query<ExecutionStep[]>('SELECT * FROM execution_steps WHERE id = ?', [id]);
    return rows[0];
  },
};
