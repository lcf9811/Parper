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
      return '未在知识库中找到相关内容。';
    }

    const formatted = results.map((r, i) =>
      `[${i + 1}] 来源：${r.doc_title}\n${r.content}`
    ).join('\n\n---\n\n');

    return `找到 ${results.length} 条相关知识：\n\n${formatted}`;
  },
  {
    name: 'knowledge_lookup',
    description: '在知识库中搜索相关内容，返回最相关的知识块',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
    }),
  }
);
