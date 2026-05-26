import { Router, Request, Response } from 'express';
import { executionService } from '../services/executionService.js';

const router = Router();

/** GET /api/executions - 获取执行记录列表 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const executions = await executionService.listExecutions();
    res.json(executions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/executions/:executionId - 获取单条执行记录 */
router.get('/:executionId', async (req: Request, res: Response) => {
  try {
    const execution = await executionService.getExecution(req.params.executionId as string);
    if (!execution) {
      res.status(404).json({ error: '执行记录不存在' });
      return;
    }
    res.json(execution);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/executions/:executionId/steps - 获取执行步骤 */
router.get('/:executionId/steps', async (req: Request, res: Response) => {
  try {
    const steps = await executionService.getSteps(req.params.executionId as string);
    res.json(steps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
