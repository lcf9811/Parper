import { query } from '../config/database.js';
import crypto from 'crypto';

export interface KnowledgeDocument {
  id: string;
  title: string;
  source: string | null;
  content: string;
  status: 'pending' | 'chunked' | 'failed';
  chunk_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  char_count: number;
  created_at: Date;
}

export const KnowledgeModel = {
  // ---- 文档 ----
  async findAllDocuments(): Promise<KnowledgeDocument[]> {
    return query<KnowledgeDocument[]>('SELECT * FROM knowledge_documents ORDER BY created_at DESC');
  },

  async findDocumentById(id: string): Promise<KnowledgeDocument | null> {
    const rows = await query<KnowledgeDocument[]>('SELECT * FROM knowledge_documents WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async createDocument(title: string, source: string | null, content: string): Promise<KnowledgeDocument> {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO knowledge_documents (id, title, source, content, status) VALUES (?, ?, ?, ?, ?)',
      [id, title, source, content, 'pending']
    );
    return (await this.findDocumentById(id))!;
  },

  async updateDocumentStatus(id: string, status: KnowledgeDocument['status'], chunkCount: number): Promise<void> {
    await query('UPDATE knowledge_documents SET status = ?, chunk_count = ? WHERE id = ?', [status, chunkCount, id]);
  },

  async removeDocument(id: string): Promise<void> {
    await query('DELETE FROM knowledge_documents WHERE id = ?', [id]);
  },

  // ---- 分块 ----
  async findChunksByDocument(documentId: string): Promise<KnowledgeChunk[]> {
    return query<KnowledgeChunk[]>(
      'SELECT * FROM knowledge_chunks WHERE document_id = ? ORDER BY chunk_index ASC',
      [documentId]
    );
  },

  async createChunk(documentId: string, chunkIndex: number, content: string): Promise<void> {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, char_count) VALUES (?, ?, ?, ?, ?)',
      [id, documentId, chunkIndex, content, content.length]
    );
  },

  async deleteChunksByDocument(documentId: string): Promise<void> {
    await query('DELETE FROM knowledge_chunks WHERE document_id = ?', [documentId]);
  },

  /** 全文搜索知识块（MySQL FULLTEXT 或 LIKE 回退） */
  async searchChunks(keyword: string, topK = 5): Promise<(KnowledgeChunk & { doc_title: string; relevance?: number })[]> {
    // 优先使用 FULLTEXT，如果失败则用 LIKE
    try {
      // KR-08: 添加 MATCH AGAINST 相关性排序
      return await query<(KnowledgeChunk & { doc_title: string; relevance?: number })[]>(
        `SELECT c.*, d.title as doc_title,
          MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance
         FROM knowledge_chunks c
         JOIN knowledge_documents d ON c.document_id = d.id
         WHERE MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE)
         ORDER BY relevance DESC
         LIMIT ?`,
        [keyword, keyword, topK]
      );
    } catch (err: any) {
      // KR-07: 只有 FULLTEXT 相关错误才降级到 LIKE，其他错误直接抛出
      const isFulltextError = err.message && (
        err.message.includes('FULLTEXT') ||
        err.message.includes('AGAINST') ||
        err.message.includes('MATCH') ||
        err.code === 'ER_PARSE_ERROR'
      );
      if (!isFulltextError) {
        console.error('[KnowledgeModel] 搜索失败（非 FULLTEXT 错误）:', err.message);
        throw err;
      }
      console.warn('[KnowledgeModel] FULLTEXT 查询失败，降级到 LIKE:', err.message);
      return await query<(KnowledgeChunk & { doc_title: string; relevance?: number })[]>(
        `SELECT c.*, d.title as doc_title
         FROM knowledge_chunks c
         JOIN knowledge_documents d ON c.document_id = d.id
         WHERE c.content LIKE ?
         ORDER BY c.chunk_index ASC
         LIMIT ?`,
        [`%${keyword}%`, topK]
      );
    }
  },
};
