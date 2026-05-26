import mysql from 'mysql2/promise';
import { env } from './env.js';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.mysql.host,
      port: env.mysql.port,
      user: env.mysql.user,
      password: env.mysql.password,
      database: env.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

/** 执行 SQL 并返回结果 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows as T;
}

/** 关闭连接池 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
