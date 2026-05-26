import { SkillModel, SkillInput } from '../models/skillModel.js';
import { syncLocalSkillsToDB, getAllSkillsWithSource } from './localSkillLoader.js';

export const skillRegistry = {
  /** 启动时同步本地 skills */
  async initialize() {
    await syncLocalSkillsToDB();
    console.log('[SkillRegistry] Local skills synced');
  },

  async listSkills() {
    return getAllSkillsWithSource();
  },

  async getEnabledSkills() {
    return SkillModel.findEnabled();
  },

  async getSkill(id: string) {
    return SkillModel.findById(id);
  },

  async createSkill(input: SkillInput) {
    return SkillModel.create(input);
  },

  async updateSkill(id: string, input: Partial<SkillInput>) {
    return SkillModel.update(id, input);
  },

  async deleteSkill(id: string) {
    return SkillModel.remove(id);
  },

  /**
   * 按选中的 skill name 列表，合并生成 system prompt
   * 如果没有选中任何 skill，则使用 general_assistant 的 prompt
   */
  async buildSystemPrompt(selectedSkillNames: string[]): Promise<string> {
    const allSkills = await SkillModel.findEnabled();

    let selected = allSkills.filter(s => selectedSkillNames.includes(s.name));

    // 如果没有选中任何 skill，默认使用 general_assistant
    if (selected.length === 0) {
      const general = allSkills.find(s => s.name === 'general_assistant');
      if (general) selected = [general];
    }

    if (selected.length === 0) {
      return '你是一个智能助手，请用中文回答用户的问题。';
    }

    if (selected.length === 1) {
      return selected[0].system_prompt;
    }

    // 多个 skill 合并
    const combined = selected
      .map((s, i) => `## 角色 ${i + 1}：${s.display_name}\n${s.system_prompt}`)
      .join('\n\n');

    const fullPrompt = `你同时具备以下多种能力，请根据用户的问题灵活运用：\n\n${combined}`;

    // 保护机制：过长的 system prompt 会严重影响 LLM 输出质量
    const MAX_PROMPT_LENGTH = 12000;
    if (fullPrompt.length > MAX_PROMPT_LENGTH) {
      console.warn(`[SkillRegistry] System prompt 过长 (${fullPrompt.length} 字符)，已选中 ${selected.length} 个技能。仅保留 general_assistant 以避免 LLM 异常。`);
      const general = allSkills.find(s => s.name === 'general_assistant');
      if (general) {
        return general.system_prompt;
      }
      return '你是一个智能助手，请用中文回答用户的问题。';
    }

    return fullPrompt;
  },
};
