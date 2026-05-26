-- ============================================================
-- 迁移：将 knowledge_chunks 的 FULLTEXT 索引改为 ngram 解析器
-- 用于修复 KR-02：中文全文搜索失效
-- 执行条件：MySQL 8.0.24+
-- ============================================================

-- 1. 删除旧的全文索引（如果存在）
ALTER TABLE knowledge_chunks DROP INDEX IF EXISTS ft_chunks_content;

-- 2. 重建全文索引，使用 ngram 解析器
ALTER TABLE knowledge_chunks ADD FULLTEXT INDEX ft_chunks_content (content) WITH PARSER ngram;

-- 3. 验证（可选）
-- SHOW CREATE TABLE knowledge_chunks;
