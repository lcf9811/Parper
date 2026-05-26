import { ExecutionModel, StepInput } from '../models/executionModel.js';

export const executionService = {
  async listExecutions(limit = 50) {
    return ExecutionModel.findAll(limit);
  },

  async getExecution(id: string) {
    return ExecutionModel.findById(id);
  },

  async getExecutionsBySession(sessionId: string) {
    return ExecutionModel.findBySession(sessionId);
  },

  async create(sessionId: string, input: string) {
    return ExecutionModel.create(sessionId, input);
  },

  async markRunning(id: string) {
    return ExecutionModel.updateStatus(id, 'running');
  },

  async complete(id: string, output: string, durationMs: number) {
    return ExecutionModel.complete(id, output, durationMs);
  },

  async fail(id: string, error: string, durationMs: number) {
    return ExecutionModel.fail(id, error, durationMs);
  },

  async setKnowledgeContext(id: string, context: any) {
    return ExecutionModel.setKnowledgeContext(id, context);
  },

  async getSteps(executionId: string) {
    return ExecutionModel.getSteps(executionId);
  },

  async addStep(executionId: string, step: StepInput) {
    return ExecutionModel.addStep(executionId, step);
  },
};
