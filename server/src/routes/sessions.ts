import { Router, Request, Response } from 'express';
import { sessionService } from '../services/sessionService.js';
import { executionService } from '../services/executionService.js';

const router = Router();

/** GET /api/sessions - 获取所有会话 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const sessions = await sessionService.listSessions();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sessions - 新建会话 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title } = req.body || {};
    const session = await sessionService.createSession(title);
    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sessions/:id - 获取单个会话 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const session = await sessionService.findById(req.params.id as string);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sessions/:id - 更新会话（标题等） */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    if (title !== undefined) {
      await sessionService.updateTitle(req.params.id as string, title);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sessions/:sessionId/messages - 获取会话消息 */
router.get('/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const messages = await sessionService.getMessages(req.params.sessionId as string);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sessions/:sessionId/executions - 获取会话执行记录 */
router.get('/:sessionId/executions', async (req: Request, res: Response) => {
  try {
    const executions = await executionService.getExecutionsBySession(req.params.sessionId as string);
    res.json(executions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/sessions/:id - 删除会话 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await sessionService.deleteSession(req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
