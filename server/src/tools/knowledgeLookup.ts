import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { knowledgeService } from '../services/knowledgeService.js';

/**
 * 内置工具：knowledge_lookup
 * 在知识库中搜索相关内容
 */
export const knowledgeLookupTool = tool(
  async ({ query }) => {
    const results = await knowledgeService.search(query, 5);

    if (results.length === 0) {
      return `未在知识库中找到与「${query}」相关的内容。`;
    }

    // 返回格式化后的可读文本（带实际换行符，非 JSON 转义）
    const lines: string[] = [`找到 ${results.length} 条相关知识：`, ''];
    for (const [i, r] of results.entries()) {
      lines.push(`**来源：${r.doc_title}**`);
      lines.push(r.content);
      if (i < results.length - 1) {
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }
    return lines.join('\n');
  },
  {
    name: 'knowledge_lookup',
    description: '在知识库中搜索相关内容，返回最相关的知识块',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
    }),
  }
);
