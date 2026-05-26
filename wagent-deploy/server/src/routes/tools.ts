import { Router, Request, Response } from 'express';
import { toolRegistry } from '../services/toolRegistry.js';
import { ToolModel } from '../models/toolModel.js';

const router = Router();

/** GET /api/tools - 获取所有工具 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const tools = await toolRegistry.listTools();
    res.json(tools);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/tools/:id - 启停工具 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled 字段必须是布尔值' });
      return;
    }
    await toolRegistry.toggleTool(req.params.id as string, enabled);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/tools/mcp - 创建 MCP 工具 */
router.post('/mcp', async (req: Request, res: Response) => {
  try {
    const { name, display_name, description, mcp_type, parameters_schema, endpoint } = req.body;
    
    if (!name || !mcp_type) {
      res.status(400).json({ error: 'Missing required fields: name, mcp_type' });
      return;
    }

    const tool = await ToolModel.createMcpTool(
      name,
      display_name || name,
      description || '',
      mcp_type,
      parameters_schema || {},
      endpoint
    );
    
    res.status(201).json(tool);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/tools/:id - 删除非内置工具 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await ToolModel.remove(req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
