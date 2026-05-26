import { Router, Request, Response } from 'express';
import { runAgent } from '../graph/runtime.js';
import { runAgentStreaming } from '../graph/runtimeStreaming.js';
import { sessionService } from '../services/sessionService.js';
import { MessageModel } from '../models/messageModel.js';
import { executionService } from '../services/executionService.js';
import { sseService } from '../services/sseService.js';
import { toolRegistry } from '../services/toolRegistry.js';

const router = Router();

/** 如果前端未指定 tools，则自动使用所有已启用的工具 */
async function resolveDefaultTools(tools?: string[]): Promise<string[]> {
  if (tools && tools.length > 0) return tools;
  const enabled = await toolRegistry.getEnabledTools();
  return enabled.map(t => t.name);
}

/** POST /api/chat - 聊天（Agent 执行入口） */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, tools, skills, generateTitle = true } = req.body;

    if (!message) {
      res.status(400).json({ error: '缺少 message 字段' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ error: '缺少 sessionId 字段' });
      return;
    }

    // 检查是否是新会话（消息数量少于2条）
    const messageCount = await MessageModel.countBySession(sessionId);
    const isNewSession = messageCount < 2;

    const resolvedTools = await resolveDefaultTools(tools);

    const result = await runAgent({
      sessionId,
      message,
      tools: resolvedTools,
      skills: skills || [],
    });

    // 如果是新会话且开启自动生成标题，异步生成标题
    if (isNewSession && generateTitle) {
      sessionService.generateTitle(sessionId, message).catch(err => {
        console.error('[Chat] 生成标题失败:', err);
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error('[Chat] 执行失败:', err);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/chat/stream - 流式聊天（返回 executionId，通过 SSE 接收实时输出） */
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, tools, skills, generateTitle = true } = req.body;

    if (!message) {
      res.status(400).json({ error: '缺少 message 字段' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ error: '缺少 sessionId 字段' });
      return;
    }

    // 检查是否是新会话（消息数量少于2条）
    const messageCount = await MessageModel.countBySession(sessionId);
    const isNewSession = messageCount < 2;

    const resolvedTools = await resolveDefaultTools(tools);

    // 创建执行记录
    const execution = await executionService.create(sessionId, message);

    // 异步启动流式执行（不等待完成）
    runAgentStreaming({
      sessionId,
      message,
      tools: resolvedTools,
      skills: skills || [],
      executionId: execution.id,
    }).then(() => {
      // 如果是新会话且开启自动生成标题，异步生成标题
      if (isNewSession && generateTitle) {
        sessionService.generateTitle(sessionId, message).catch(err => {
          console.error('[Chat] 生成标题失败:', err);
        });
      }
    }).catch(err => {
      console.error('[Chat] 流式执行失败:', err);
    });

    // 立即返回 executionId，客户端使用它连接 SSE
    res.json({
      executionId: execution.id,
      sessionId,
      status: 'streaming',
      message: '使用 executionId 连接到 /api/stream/:executionId 接收实时输出',
    });
  } catch (err: any) {
    console.error('[Chat] 启动流式执行失败:', err);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/stream/:executionId - SSE 流式输出端点 */
router.get('/stream/:executionId', async (req: Request, res: Response) => {
  const executionId = req.params.executionId as string;

  if (!executionId) {
    res.status(400).json({ error: '缺少 executionId 参数' });
    return;
  }

  // 检查执行记录是否存在
  const execution = await executionService.getExecution(executionId);
  if (!execution) {
    res.status(404).json({ error: '执行记录不存在' });
    return;
  }

  // 注册 SSE 客户端连接
  sseService.registerClient(executionId, res);

  // 如果执行已完成，立即发送完成事件
  if (execution.status === 'completed') {
    sseService.emitOutput(executionId, execution.output || '', false);
    sseService.emitComplete(executionId, 'done', {
      reply: execution.output,
      durationMs: execution.duration_ms,
    });
    setTimeout(() => {
      sseService.closeConnection(executionId);
    }, 1000);
    return;
  } else if (execution.status === 'failed') {
    sseService.emitError(executionId, execution.error || '执行失败');
    sseService.emitComplete(executionId, 'error', {
      error: execution.error,
    });
    setTimeout(() => {
      sseService.closeConnection(executionId);
    }, 1000);
    return;
  }

  // 如果状态是 running 或 pending，保持连接直到执行完成
  // 使用轮询检查执行状态，确保 SSE 连接不会因 Express 返回而关闭
  console.log(`[SSE] Starting polling for execution ${executionId}, initial status: ${execution.status}`);
  let lastKnownStatus: 'pending' | 'running' | 'completed' | 'failed' = execution.status;
  let keepaliveCounter = 0; // 用于发送 keepalive ping 防止连接超时
  const checkInterval = setInterval(async () => {
    try {
      const currentExecution = await executionService.getExecution(executionId);
      if (!currentExecution) {
        console.log(`[SSE] Execution ${executionId} not found, closing connection`);
        clearInterval(checkInterval);
        sseService.closeConnection(executionId);
        return;
      }

      // Log status changes
      if (currentExecution.status !== lastKnownStatus) {
        console.log(`[SSE] Execution ${executionId} status changed: ${lastKnownStatus} -> ${currentExecution.status}`);
        lastKnownStatus = currentExecution.status;
      }

      // 发送 keepalive ping 防止 Express 连接超时（每 6 秒一次）
      // SSE 注释行不会触发前端 onmessage，但能保持连接活跃
      if (currentExecution.status === 'running' || currentExecution.status === 'pending') {
        keepaliveCounter++;
        if (keepaliveCounter >= 12) { // 500ms * 12 = 6s
          try {
            sseService.emit(executionId, 'keepalive', { timestamp: Date.now() });
          } catch (e) {
            // 忽略 keepalive 发送失败（客户端可能已断开）
          }
          keepaliveCounter = 0;
        }
      }

      if (currentExecution.status === 'completed') {
        clearInterval(checkInterval);
        console.log(`[SSE] Execution ${executionId} completed, output length: ${currentExecution.output?.length || 0}`);
        // 如果客户端仍连接，说明 runAgentStreaming 已经发送了完整事件流
        // 延迟关闭连接即可；如果客户端已断开，发送 fallback 事件
        if (sseService.hasConnection(executionId)) {
          console.log(`[SSE] Client still connected for ${executionId}, runAgentStreaming already sent events. Closing in 2s.`);
          setTimeout(() => {
            sseService.closeConnection(executionId);
          }, 2000);
        } else {
          console.log(`[SSE] Client disconnected for ${executionId}, sending fallback events`);
          if (currentExecution.output) {
            sseService.emitOutput(executionId, currentExecution.output, false);
          }
          sseService.emitComplete(executionId, 'done', {
            reply: currentExecution.output,
            durationMs: currentExecution.duration_ms,
          });
          setTimeout(() => {
            sseService.closeConnection(executionId);
          }, 1000);
        }
      } else if (currentExecution.status === 'failed') {
        clearInterval(checkInterval);
        console.log(`[SSE] Execution ${executionId} failed: ${currentExecution.error}`);
        // 同理：客户端已连接则 runAgentStreaming 已发送错误事件
        if (sseService.hasConnection(executionId)) {
          console.log(`[SSE] Client still connected for ${executionId} (failed), closing in 2s.`);
          setTimeout(() => {
            sseService.closeConnection(executionId);
          }, 2000);
        } else {
          sseService.emitError(executionId, currentExecution.error || '执行失败');
          sseService.emitComplete(executionId, 'error', {
            error: currentExecution.error,
          });
          setTimeout(() => {
            sseService.closeConnection(executionId);
          }, 1000);
        }
      }
      // 如果仍在运行，继续等待
    } catch (err) {
      console.error('[SSE] Error checking execution status:', err);
      clearInterval(checkInterval);
      sseService.closeConnection(executionId);
    }
  }, 500); // 每 500ms 检查一次

  // 监听客户端断开，清理定时器并移除 SSE 客户端（BE-13 修复）
  req.on('close', () => {
    console.log(`[SSE] Request closed for execution ${executionId}, cleaning up polling`);
    clearInterval(checkInterval);
    sseService.removeClient(executionId);
  });
});

export default router;
