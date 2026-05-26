import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.includes('default') || jwtSecret.length < 32) {
  console.error('[FATAL] JWT_SECRET 未配置或过于简单。请在 .env 中设置一个长度不少于 32 位的随机密钥。');
  process.exit(1);
}

export const env = {
  port: parseInt(process.env.PORT || '8787', 10),
  baseURL: process.env.BASE_URL || undefined,

  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sop_db',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  },

  jwtSecret,
};
