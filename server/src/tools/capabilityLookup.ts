/**
 * 能力查询工具
 * 列出所有已注册的外部能力（Web API + Python 脚本）
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { capabilityRegistry } from '../services/capabilityRegistry.js';

export const capabilityLookupTool = tool(
  async ({ skill_name }: { skill_name?: string }) => {
    const caps = capabilityRegistry.list(skill_name);

    if (caps.length === 0) {
      return JSON.stringify({
        found: false,
        message: skill_name
          ? `技能 '${skill_name}' 没有声明任何外部能力。`
          : '当前没有注册任何外部能力。',
        capabilities: [],
      });
    }

    const result = caps.map(cap => ({
      id: cap.id,
      name: cap.name,
      type: cap.type,
      description: cap.description,
      skill: cap.skillName,
      enabled: cap.enabled,
      parameters: cap.config.parameters.map(p => ({
        name: p.name,
        type: p.type,
        required: p.required,
        description: p.description,
      })),
    }));

    return JSON.stringify({
      found: true,
      count: result.length,
      capabilities: result,
    }, null, 2);
  },
  {
    name: 'capability_lookup',
    description: '查询所有已注册的外部能力（Web API 和 Python 脚本）。可用于查看当前可用的扩展能力列表。',
    schema: z.object({
      skill_name: z.string().optional().describe('按技能名称过滤（可选）'),
    }),
  }
);

export default capabilityLookupTool;
