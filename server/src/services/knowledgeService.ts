import { KnowledgeModel } from '../models/knowledgeModel.js';
import { chunkText } from '../utils/chunker.js';
import { providerService } from './providerService.js';

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
      // KR-09: 从配置读取分块参数
      let chunkSize = 500;
      let chunkOverlap = 50;
      try {
        const cfg = await providerService.getLangGraphConfig() as any;
        if (cfg.chunk_size && cfg.chunk_size > 0) chunkSize = cfg.chunk_size;
        if (cfg.chunk_overlap && cfg.chunk_overlap >= 0) chunkOverlap = cfg.chunk_overlap;
      } catch {
        // 使用默认值
      }

      // 2. 切块
      const chunks = chunkText(content, chunkSize, chunkOverlap);

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
