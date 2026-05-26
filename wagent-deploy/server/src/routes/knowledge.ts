import { Router, Request, Response } from 'express';
import { knowledgeService } from '../services/knowledgeService.js';

const router = Router();

/** GET /api/knowledge - 获取所有知识文档 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs = await knowledgeService.listDocuments();
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/knowledge/:id/chunks - 获取文档分块 */
router.get('/:id/chunks', async (req: Request, res: Response) => {
  try {
    const chunks = await knowledgeService.getChunks(req.params.id as string);
    res.json(chunks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/knowledge - 录入知识文档 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, source, content } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: '缺少必填字段: title, content' });
      return;
    }
    const doc = await knowledgeService.ingest(title, source || null, content);
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/knowledge/:id - 删除知识文档 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await knowledgeService.deleteDocument(req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/knowledge/search - 搜索知识 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, topK } = req.body;
    if (!query) {
      res.status(400).json({ error: '缺少 query 字段' });
      return;
    }
    const results = await knowledgeService.search(query, topK || 5);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
