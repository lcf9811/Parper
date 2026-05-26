/**
 * Webhook 端点管理路由
 * 用于创建、管理 Webhook 端点
 */
import { Router, Request, Response } from 'express';
import { WebhookEndpointModel } from '../models/webhookEndpointModel.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * GET /api/webhook/endpoints - 获取所有 Webhook 端点
 */
router.get('/endpoints', async (req: Request, res: Response) => {
  try {
    const endpoints = await WebhookEndpointModel.findAll();
    
    // 构造完整的 Webhook URL
    // 优先使用配置的 BASE_URL，否则使用请求的 origin
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseURL = env.baseURL || `${protocol}://${host}`;
    
    const fullEndpoints = endpoints.map(ep => ({
      ...ep,
      full_url: `${baseURL}${ep.webhook_url}`
    }));
    
    res.json(fullEndpoints);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/webhook/endpoints - 创建 Webhook 端点
 * 
 * 请求体:
 * {
 *   sessionId: string;
 *   selectedTools: string[];
 *   selectedSkills: string[];
 *   description?: string;
 * }
 * 
 * 响应:
 * {
 *   id: string;
 *   session_id: string;
 *   webhook_url: string;      // 如: /webhook/abc123
 *   full_url: string;         // 如: http://localhost:8787/webhook/abc123
 *   bearer_key: string;       // 如: wh_xxxxxxxx
 *   selected_tools: string[];
 *   selected_skills: string[];
 *   description: string;
 *   enabled: boolean;
 * }
 */
router.post('/endpoints', async (req: Request, res: Response) => {
  try {
    const { sessionId, selectedTools, selectedSkills, description } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const endpoint = await WebhookEndpointModel.create({
      sessionId,
      selectedTools: selectedTools || [],
      selectedSkills: selectedSkills || [],
      description
    });

    // 构造完整的 URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseURL = env.baseURL || `${protocol}://${host}`;
    
    res.status(201).json({
      ...endpoint,
      full_url: `${baseURL}${endpoint.webhook_url}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/webhook/endpoints/:id - 更新 Webhook 端点
 */
router.put('/endpoints/:id', async (req: Request, res: Response) => {
  try {
    const { sessionId, selectedTools, selectedSkills, description } = req.body;
    await WebhookEndpointModel.update(req.params.id as string, {
      sessionId,
      selectedTools: selectedTools || [],
      selectedSkills: selectedSkills || [],
      description
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/webhook/endpoints/:id/toggle - 启用/禁用 Webhook
 */
router.put('/endpoints/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    await WebhookEndpointModel.toggleEnabled(req.params.id as string, enabled);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/webhook/endpoints/:id - 删除 Webhook 端点
 */
router.delete('/endpoints/:id', async (req: Request, res: Response) => {
  try {
    await WebhookEndpointModel.remove(req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
