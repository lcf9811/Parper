/**
 * 用户管理路由
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserModel } from '../models/userModel.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/users - 获取所有用户（仅管理员）
 */
router.get('/', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await UserModel.findAll();
    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      isAdmin: u.is_admin,
      createdAt: u.created_at
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users - 创建用户（仅管理员）
 */
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, displayName, isAdmin } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await UserModel.findByUsername(username);
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      username,
      passwordHash,
      displayName: displayName || username,
      isAdmin: isAdmin || false
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      isAdmin: user.is_admin
    });
  } catch (err: any) {
    console.error('[Users] Create user error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users/:id/reset-password - 重置密码（仅管理员）
 */
router.post('/:id/reset-password', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await UserModel.updatePassword(id as string, passwordHash);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/users/:id - 删除用户（仅管理员）
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user!.id) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    await UserModel.remove(id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
