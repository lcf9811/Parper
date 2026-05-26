/**
 * 长期记忆路由
 */
import { Router, Request, Response } from 'express';
import { MemoryModel, MemoryType } from '../models/memoryModel.js';

const router = Router();

/** GET /api/memories - 获取所有记忆 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const memories = await MemoryModel.findAll(type as MemoryType);
    res.json(memories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/memories/search - 搜索记忆 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }
    const memories = await MemoryModel.search(q);
    res.json(memories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/memories - 创建记忆 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, content, context, importance, sourceSessionId } = req.body;
    
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    
    const memory = await MemoryModel.create({
      type: type || 'fact',
      content,
      context,
      importance,
      sourceSessionId
    });
    
    res.status(201).json(memory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/memories/:id - 更新记忆 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { type, content, context, importance } = req.body;
    await MemoryModel.update(req.params.id as string, { type, content, context, importance });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/memories/:id - 删除记忆 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await MemoryModel.remove(req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
