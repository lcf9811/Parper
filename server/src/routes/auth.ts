/**
 * 认证路由
 * 登录、注册、用户信息
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/userModel.js';
import { env } from '../config/env.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register - 用户注册
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // 检查用户名是否已存在
    const existing = await UserModel.findByUsername(username);
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      username,
      passwordHash,
      displayName: displayName || username,
      isAdmin: false
    });

    // 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: user.is_admin },
      env.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        isAdmin: user.is_admin
      }
    });
  } catch (err: any) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login - 用户登录
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // 查找用户
    const user = await UserModel.findByUsername(username);
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: user.is_admin },
      env.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        isAdmin: user.is_admin
      }
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout - 用户登出
 * （客户端只需删除 token）
 */
router.post('/logout', authMiddleware, async (_req: AuthRequest, res: Response) => {
  // 如果需要，可以在这里处理服务器端的会话清理
  res.json({ ok: true });
});

/**
 * GET /api/auth/me - 获取当前用户信息
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      isAdmin: user.is_admin
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
