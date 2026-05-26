import { KnowledgeModel } from '../models/knowledgeModel.js';
import { chunkText } from '../utils/chunker.js';

export const knowledgeService = {
  async listDocuments() {
    return KnowledgeModel.findAllDocuments();
  },

  async getDocument(id: string) {
    return KnowledgeModel.findDocumentById(id);
  },

  async getChunks(documentId: string) {
    return KnowledgeModel.findChunksByDocument(documentId);
  },

  /**
   * 文档入库：保存文档 → 自动切块 → 更新状态
   */
  async ingest(title: string, source: string | null, content: string) {
    // 1. 创建文档记录
    const doc = await KnowledgeModel.createDocument(title, source, content);

    try {
      // 2. 切块
      const chunks = chunkText(content, 500, 50);

      // 3. 写入分块
      for (const chunk of chunks) {
        await KnowledgeModel.createChunk(doc.id, chunk.index, chunk.content);
      }

      // 4. 更新文档状态
      await KnowledgeModel.updateDocumentStatus(doc.id, 'chunked', chunks.length);

      console.log(`[Knowledge] 文档 "${title}" 已入库，共 ${chunks.length} 块`);
      return { ...doc, status: 'chunked' as const, chunk_count: chunks.length };
    } catch (err) {
      await KnowledgeModel.updateDocumentStatus(doc.id, 'failed', 0);
      throw err;
    }
  },

  /**
   * 搜索知识库
   */
  async search(query: string, topK = 5) {
    return KnowledgeModel.searchChunks(query, topK);
  },

  async deleteDocument(id: string) {
    return KnowledgeModel.removeDocument(id);
  },
};
