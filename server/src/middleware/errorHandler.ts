import { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[Error]', err);
  const status = err.status || err.statusCode || 500;
  // OT-01: 生产环境不返回原始错误信息（可能包含堆栈、SQL 语句）
  const message = isProduction
    ? '服务器内部错误'
    : (err.message || '服务器内部错误');
  res.status(status).json({ error: message });
}
