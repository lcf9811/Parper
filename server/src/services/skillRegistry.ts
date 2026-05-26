import { SkillModel, SkillInput } from '../models/skillModel.js';
import { syncLocalSkillsToDB, getAllSkillsWithSource } from './localSkillLoader.js';
import { capabilityRegistry } from './capabilityRegistry.js';

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
   * 如果提供了工具列表，则在 prompt 中添加工具使用引导
   * 同时注入选中技能的 capabilities 描述
   */
  async buildSystemPrompt(selectedSkillNames: string[], availableTools?: { name: string; description: string }[]): Promise<string> {
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

    // 构建工具使用引导
    let toolGuidance = '';
    if (availableTools && availableTools.length > 0) {
      const toolList = availableTools.map(t => `- **${t.name}**: ${t.description}`).join('\n');
      toolGuidance = `## 可用工具\n\n你拥有以下工具，可以根据需要主动调用：\n\n${toolList}\n\n调用规则：\n1. 当用户的问题需要你执行具体操作（如查询知识、执行命令、获取时间等）时，应优先调用相应工具\n2. 调用工具时，请使用工具调用格式，不要只是在文字中提及工具名称\n3. 根据工具返回的结果，结合你的知识给出完整回答\n4. 如果工具返回的信息不足以回答问题，可以继续调用其他工具或基于已有信息回答\n\n`;
    }

    // 注入 capabilities 描述
    const capabilities = capabilityRegistry.listBySkillNames(selectedSkillNames);
    const capabilityGuidance = capabilityRegistry.buildCapabilityGuidance(capabilities);

    let corePrompt: string;
    if (selected.length === 1) {
      corePrompt = selected[0].system_prompt;
    } else {
      // 多个 skill 合并
      const combined = selected
        .map((s, i) => `## 角色 ${i + 1}：${s.display_name}\n${s.system_prompt}`)
        .join('\n\n');
      corePrompt = `你同时具备以下多种能力，请根据用户的问题灵活运用：\n\n${combined}`;
    }

    // 工具引导 + 能力引导 + 核心 prompt，确保 LLM 优先看到工具和能力
    const fullPrompt = toolGuidance + capabilityGuidance + corePrompt;

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
