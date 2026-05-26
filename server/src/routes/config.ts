import { Router, Request, Response } from 'express';
import { providerService } from '../services/providerService.js';

const router = Router();

// ---- LLM Providers ----

/** GET /api/config/providers - 获取所有 Provider */
router.get('/providers', async (_req: Request, res: Response) => {
  try {
    const providers = await providerService.listProviders();
    // 隐藏 API Key（只返回前 8 位）
    const safe = providers.map(p => ({
      ...p,
      api_key: p.api_key ? p.api_key.substring(0, 8) + '***' : null,
    }));
    res.json(safe);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/config/providers - 新建 Provider */
router.post('/providers', async (req: Request, res: Response) => {
  try {
    const { name, api_base_url, api_key, default_model } = req.body;
    if (!name) {
      res.status(400).json({ error: '缺少 name 字段' });
      return;
    }
    const provider = await providerService.createProvider(name, api_base_url, api_key, default_model);
    res.status(201).json(provider);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/config/providers/:id - 更新 Provider */
router.put('/providers/:id', async (req: Request, res: Response) => {
  try {
    await providerService.updateProvider(req.params.id as string, req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/config/providers/:id/activate - 激活 Provider */
router.put('/providers/:id/activate', async (req: Request, res: Response) => {
  try {
    await providerService.setActiveProvider(req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/config/providers/:id - 删除 Provider */
router.delete('/providers/:id', async (req: Request, res: Response) => {
  try {
    await providerService.removeProvider(req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- LangGraph Config ----

/** GET /api/config/langgraph - 获取 LangGraph 配置 */
router.get('/langgraph', async (_req: Request, res: Response) => {
  try {
    const config = await providerService.getLangGraphConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/config/langgraph - 更新 LangGraph 配置 */
router.put('/langgraph', async (req: Request, res: Response) => {
  try {
    await providerService.updateLangGraphConfig(req.body);
    const config = await providerService.getLangGraphConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
