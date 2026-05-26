import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[Error]', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || '服务器内部错误';
  res.status(status).json({ error: message });
}
