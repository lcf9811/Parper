/**
 * 数据库初始化脚本
 * 读取 sql/init.sql 并执行
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../config/database.js';
import '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sqlPath = path.resolve(__dirname, '../../../sql/init.sql');
  console.log('[DB Init] 读取 SQL 文件:', sqlPath);

  if (!fs.existsSync(sqlPath)) {
    console.error('[DB Init] SQL 文件不存在:', sqlPath);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // 更好的 SQL 解析：先按行处理，移除注释，再按分号拆分
  const lines = sqlContent.split('\n');
  const cleanedLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行和注释行
    if (trimmed.length === 0 || trimmed.startsWith('--')) {
      continue;
    }
    cleanedLines.push(line);
  }
  
  // 按分号拆分语句
  const statements = cleanedLines
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const pool = getPool();

  console.log(`[DB Init] 共 ${statements.length} 条语句`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await pool.execute(stmt);
      console.log(`[DB Init] (${i + 1}/${statements.length}) OK`);
    } catch (err: any) {
      // 忽略 "表已存在" 等非致命错误
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_ENTRY') {
        console.log(`[DB Init] (${i + 1}/${statements.length}) 已存在，跳过`);
      } else if (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_DUP_FIELDNAME') {
        // 忽略字段已存在/不存在的错误
        console.log(`[DB Init] (${i + 1}/${statements.length}) 字段已存在或不存在，跳过`);
      } else if (err.sqlMessage?.includes('syntax') && stmt.includes('ALTER TABLE')) {
        // 忽略 ALTER TABLE 语法错误（版本兼容）
        console.log(`[DB Init] (${i + 1}/${statements.length}) ALTER 语句跳过`);
      } else {
        console.error(`[DB Init] (${i + 1}/${statements.length}) 失败:`, err.message);
        console.error('  SQL:', stmt.substring(0, 100) + '...');
      }
    }
  }

  await closePool();
  console.log('[DB Init] 初始化完成');
}

run().catch(err => {
  console.error('[DB Init] 执行失败:', err);
  process.exit(1);
});
