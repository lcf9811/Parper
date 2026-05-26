/**
 * Webhook 路由
 * 接收外部系统的消息并调用 Agent 处理
 */
import { Router, Request, Response } from 'express';
import { runAgent } from '../graph/runtime.js';
import { sessionService } from '../services/sessionService.js';
import { providerService } from '../services/providerService.js';

const router = Router();

export interface WebhookRequest {
  message: string;
  sessionId?: string | null;
  selectedTools?: string[];
  selectedSkills?: string[];
  webhookUrl?: string | null;  // 回调 URL
  metadata?: Record<string, any>;  // 自定义元数据
}

export interface WebhookResponse {
  success: boolean;
  sessionId: string;
  executionId: string;
  reply?: string;
  error?: string;
}

/**
 * POST /api/webhook/chat - Webhook 接收消息
 * 
 * 请求体:
 * {
 *   "message": "用户消息",
 *   "sessionId": "可选的会话ID",
 *   "selectedTools": ["current_time", "exec_command"],
 *   "selectedSkills": ["general_assistant"],
 *   "webhookUrl": "可选的回调URL",
 *   "metadata": { "source": "slack", "userId": "123" }
 * }
 */
router.post('/chat', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const {
      message,
      sessionId: inputSessionId,
      selectedTools = [],
      selectedSkills = ['general_assistant'],
      webhookUrl,
      metadata = {},
    }: WebhookRequest = req.body;

    // 验证请求
    if (!message || message.trim() === '') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    console.log(`[Webhook] Received message: ${message.substring(0, 50)}...`);
    console.log(`[Webhook] From: ${req.ip}, Metadata:`, metadata);

    // 获取或创建会话
    let sessionId = inputSessionId;
    if (!sessionId) {
      const session = await sessionService.createSession('Webhook Session');
      sessionId = session.id;
      console.log(`[Webhook] Created new session: ${sessionId}`);
    }

    // 保存用户消息
    await sessionService.addMessage(sessionId, 'user', message.trim());

    // 调用 Agent 处理
    const result = await runAgent({
      sessionId,
      message: message.trim(),
      tools: selectedTools,
      skills: selectedSkills,
    });

    console.log(`[Webhook] Agent response generated, executionId: ${result.executionId}`);

    // 构建响应
    const response: WebhookResponse = {
      success: true,
      sessionId,
      executionId: result.executionId,
      reply: result.reply,
    };

    // 如果有回调 URL，异步发送结果
    if (webhookUrl) {
      sendWebhookCallback(webhookUrl, response, metadata).catch(err => {
        console.error('[Webhook] Callback failed:', err.message);
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Processed in ${duration}ms`);

    res.status(200).json(response);
  } catch (err: any) {
    console.error('[Webhook] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      sessionId: req.body?.sessionId || null,
      executionId: '',
    });
  }
});

/**
 * POST /api/webhook/callback-test - 测试回调接收端点
 */
router.post('/callback-test', async (req: Request, res: Response) => {
  console.log('[Webhook] Callback received:', JSON.stringify(req.body, null, 2));
  res.json({ received: true, timestamp: new Date().toISOString() });
});

/**
 * GET /api/webhook/sessions/:sessionId/messages - 获取会话消息
 */
router.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const messages = await sessionService.getMessages(req.params.sessionId as string);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/webhook/config - 获取 Webhook 配置
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    // 从数据库或配置文件中读取
    const config = await getWebhookConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/webhook/config - 更新 Webhook 配置
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { defaultWebhookUrl, enabled, mappings } = req.body;
    await saveWebhookConfig({ defaultWebhookUrl, enabled, mappings });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 内存中的配置（实际应该持久化到数据库）
let webhookConfig: any = {
  defaultWebhookUrl: '',
  enabled: false,
  mappings: []
};

async function getWebhookConfig() {
  // TODO: 从数据库读取
  return webhookConfig;
}

async function saveWebhookConfig(config: any) {
  // TODO: 保存到数据库
  webhookConfig = { ...webhookConfig, ...config };
  return webhookConfig;
}

/**
 * 发送 Webhook 回调
 */
async function sendWebhookCallback(
  url: string,
  data: WebhookResponse,
  metadata: Record<string, any>
): Promise<void> {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WAgent-Webhook': '1',
      },
      body: JSON.stringify({
        ...data,
        metadata,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`[Webhook] Callback sent to ${url}`);
  } catch (error: any) {
    console.error(`[Webhook] Failed to send callback: ${error.message}`);
    throw error;
  }
}

export default router;
