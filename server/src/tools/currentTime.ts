import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 内置工具：current_time
 * 返回当前日期和时间
 */
export const currentTimeTool = tool(
  async () => {
    const now = new Date();
    return JSON.stringify({
      iso: now.toISOString(),
      local: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      timestamp: now.getTime(),
    });
  },
  {
    name: 'current_time',
    description: '返回当前的日期和时间',
    schema: z.object({}),
  }
);
