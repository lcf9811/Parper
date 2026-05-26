import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { skillRegistry } from '../services/skillRegistry.js';

/**
 * 内置工具：skill_catalog
 * 列出所有可用的技能
 */
export const skillCatalogTool = tool(
  async () => {
    const skills = await skillRegistry.listSkills();

    if (skills.length === 0) {
      return '当前没有可用的技能。';
    }

    const formatted = skills.map(s =>
      `- **${s.display_name}** (${s.name}): ${s.description || '无描述'} [${s.enabled ? '已启用' : '已禁用'}]`
    ).join('\n');

    return `可用技能列表：\n\n${formatted}`;
  },
  {
    name: 'skill_catalog',
    description: '列出所有可用的技能及其描述',
    schema: z.object({}),
  }
);
