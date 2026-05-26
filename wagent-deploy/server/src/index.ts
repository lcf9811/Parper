import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { getPool } from './config/database.js';

// ---------- Routes ----------
import healthRouter from './routes/health.js';
import toolsRouter from './routes/tools.js';
import skillsRouter from './routes/skills.js';
import knowledgeRouter from './routes/knowledge.js';
import sessionsRouter from './routes/sessions.js';
import executionsRouter from './routes/executions.js';
import chatRouter from './routes/chat.js';
import configRouter from './routes/config.js';
import webhookRouter from './routes/webhook.js';
import webhookEndpointsRouter from './routes/webhookEndpoints.js';
import webhookReceiverRouter from './routes/webhookReceiver.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import memoryRouter from './routes/memory.js';

// ---------- Middleware ----------
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

const app = express();

// ---------- 全局中间件 ----------
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// ---------- 路由挂载 ----------
// 独立的 Webhook 接收路由（外部直接访问，无需 /api 前缀）
app.use('/webhook', webhookReceiverRouter);

// API 路由
app.use('/api', healthRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/executions', executionsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/config', configRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/webhook', webhookEndpointsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/memories', memoryRouter);

// ---------- 错误处理 ----------
app.use(errorHandler);

// ---------- Services ----------
import { toolRegistry } from './services/toolRegistry.js';
import { skillRegistry } from './services/skillRegistry.js';
import { UserModel } from './models/userModel.js';

// ---------- 启动 ----------
async function start() {
  try {
    // 测试数据库连接
    const pool = getPool();
    const conn = await pool.getConnection();
    console.log('[DB] MySQL 连接成功');
    conn.release();

    // 初始化工具注册表
    await toolRegistry.initialize();
    
    // 初始化本地 skills
    await skillRegistry.initialize();
    
    // 确保默认管理员账号存在
    await UserModel.ensureDefaultAdmin();

    app.listen(env.port, () => {
      console.log(`[Server] WAgent 后端已启动: http://localhost:${env.port}`);
      console.log(`[Server] 健康检查: http://localhost:${env.port}/api/health`);
    });
  } catch (err) {
    console.error('[Server] 启动失败:', err);
    process.exit(1);
  }
}

start();

export default app;
