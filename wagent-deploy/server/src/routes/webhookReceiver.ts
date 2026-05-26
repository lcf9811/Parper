/**
 * Webhook 接收路由
 * 用于接收外部系统的 Webhook 调用，支持 SSE 流式输出
 */
import { Router, Request, Response } from 'express';
import { WebhookEndpointModel } from '../models/webhookEndpointModel.js';
import { runAgentStreaming } from '../graph/runtimeStreaming.js';
import { sessionService } from '../services/sessionService.js';
import { executionService } from '../services/executionService.js';
import { sseService } from '../services/sseService.js';

const router = Router();

/**
 * POST /webhook/:token - 接收 Webhook 调用
 * 
 * 请求头:
 * Authorization: Bearer <bearer_key>
 * Content-Type: application/json
 * 
 * 请求体:
 * {
 *   message: string;
 *   metadata?: object;
 *   stream?: boolean;  // 是否启用 SSE 流式输出，默认为 false
 * }
 * 
 * 响应（非流式/流式）:
 * {
 *   success: true,
 *   sessionId: string,
 *   executionId: string,
 *   timestamp: string,  // ISO 8601 format
 *   streamUrl?: string  // SSE 连接地址（仅流式模式）
 * }
 */
router.post('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    // 从 Authorization 头获取 Bearer Key
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    
    const bearerKey = authHeader.substring(7);
    
    // 查找 Webhook 端点
    const endpoint = await WebhookEndpointModel.findByBearerKey(bearerKey);
    if (!endpoint) {
      res.status(401).json({ error: 'Invalid bearer key' });
      return;
    }
    
    if (!endpoint.enabled) {
      res.status(403).json({ error: 'Webhook endpoint is disabled' });
      return;
    }
    
    // 验证 URL token 是否匹配
    if (!endpoint.webhook_url.endsWith(`/${token}`)) {
      res.status(401).json({ error: 'Invalid webhook token' });
      return;
    }
    
    const { message, metadata = {}, stream = false } = req.body;
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    
    console.log(`[Webhook] Received call to ${endpoint.webhook_url}`);
    console.log(`[Webhook] Session: ${endpoint.session_id}`);
    console.log(`[Webhook] Message length: ${message.length}`);
    console.log(`[Webhook] Stream mode: ${stream}`);
    
    // 保存用户消息到会话 - 标记为 webhook 来源
    const safeMessage = message ?? null;
    await sessionService.addMessage(endpoint.session_id, 'user', safeMessage, undefined, 'webhook');
    
    // 流式模式
    if (stream) {
      // 创建执行记录
      const execution = await executionService.create(endpoint.session_id, safeMessage ?? '');
      
      // 异步启动流式执行（不等待完成）
      // skipSaveUserMessage: true 因为消息已在上面保存
      runAgentStreaming({
        sessionId: endpoint.session_id,
        message: safeMessage ?? '',
        tools: endpoint.selected_tools ?? [],
        skills: endpoint.selected_skills ?? [],
        executionId: execution.id,
        skipSaveUserMessage: true,
      }).catch(err => {
        console.error('[Webhook] 流式执行失败:', err);
      });
      
      // 构建流式 URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const streamUrl = `${protocol}://${host}/api/stream/${execution.id}`;
      
      res.json({
        success: true,
        sessionId: endpoint.session_id,
        executionId: execution.id,
        streamUrl,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // 非流式模式 - 但仍使用流式执行以发布 SSE 事件
    const execution = await executionService.create(endpoint.session_id, safeMessage ?? '');
    
    // 异步启动流式执行（不等待完成），这样可以通过 SSE 监听实时进度
    // skipSaveUserMessage: true 因为消息已在上面保存
    runAgentStreaming({
      sessionId: endpoint.session_id,
      message: safeMessage ?? '',
      tools: endpoint.selected_tools ?? [],
      skills: endpoint.selected_skills ?? [],
      executionId: execution.id,
      skipSaveUserMessage: true,
    }).catch(err => {
      console.error('[Webhook] 流式执行失败:', err);
    });
    
    res.json({
      success: true,
      sessionId: endpoint.session_id,
      executionId: execution.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[Webhook] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /webhook/:token - Webhook 健康检查
 */
router.get('/:token', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Webhook endpoint is active. Use POST method to send messages.',
    timestamp: new Date().toISOString(),
  });
});

export default router;
