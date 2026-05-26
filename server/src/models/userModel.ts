/**
 * 用户模型
 */
import { query } from '../config/database.js';
import crypto from 'crypto';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserInput {
  username: string;
  passwordHash: string;
  displayName?: string;
  isAdmin?: boolean;
}

export const UserModel = {
  async findAll(): Promise<User[]> {
    return query<User[]>('SELECT * FROM users ORDER BY created_at DESC');
  },

  async findById(id: string): Promise<User | null> {
    const rows = await query<User[]>('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByUsername(username: string): Promise<User | null> {
    const rows = await query<User[]>('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  },

  async create(input: UserInput): Promise<User> {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        input.username,
        input.passwordHash,
        input.displayName || input.username,
        input.isAdmin ? 1 : 0
      ]
    );
    return (await this.findById(id))!;
  },

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  },

  async remove(id: string): Promise<void> {
    await query('DELETE FROM users WHERE id = ?', [id]);
  },

  // 创建默认管理员账号（如果不存在）
  async ensureDefaultAdmin(): Promise<void> {
    const existing = await this.findByUsername('admin');
    if (!existing) {
      // 密码: admin123 (bcrypt hash)
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('admin123', 10);
      await this.create({
        username: 'admin',
        passwordHash,
        displayName: '管理员',
        isAdmin: true
      });
      console.log('[UserModel] Default admin user created (admin/admin123)');
    }
  }
};

export default UserModel;
