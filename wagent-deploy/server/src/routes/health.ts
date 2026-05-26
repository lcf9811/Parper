import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'wagent',
    timestamp: new Date().toISOString(),
  });
});

export default router;
