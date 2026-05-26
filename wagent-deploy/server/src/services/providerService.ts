import { ChatOpenAI } from '@langchain/openai';
import { ProviderModel } from '../models/providerModel.js';
import { env } from '../config/env.js';

export const providerService = {
  async listProviders() {
    return ProviderModel.findAllProviders();
  },

  async getProvider(id: string) {
    return ProviderModel.findProviderById(id);
  },

  async getActiveProvider() {
    return ProviderModel.getActiveProvider();
  },

  async createProvider(name: string, apiBaseUrl?: string, apiKey?: string, defaultModel?: string) {
    return ProviderModel.createProvider(name, apiBaseUrl, apiKey, defaultModel);
  },

  async updateProvider(id: string, fields: any) {
    return ProviderModel.updateProvider(id, fields);
  },

  async setActiveProvider(id: string) {
    return ProviderModel.setActiveProvider(id);
  },

  async removeProvider(id: string) {
    return ProviderModel.removeProvider(id);
  },

  // ---- LangGraph Config ----
  async getLangGraphConfig() {
    return ProviderModel.getLangGraphConfig();
  },

  async updateLangGraphConfig(fields: any) {
    return ProviderModel.updateLangGraphConfig(fields);
  },

  /**
   * 根据激活的 Provider 创建 ChatOpenAI 实例
   * @param modelType 模型类型：default / planner / reviewer
   */
  async getLLMInstance(modelType: 'default' | 'planner' | 'reviewer' = 'default'): Promise<ChatOpenAI> {
    const provider = await ProviderModel.getActiveProvider();

    // 确定 API Key 和 Base URL
    let apiKey = provider?.api_key || env.openai.apiKey;
    let baseURL = provider?.api_base_url || env.openai.baseURL;
    let model = env.openai.model;

    if (provider) {
      switch (modelType) {
        case 'planner':
          model = provider.planner_model || provider.default_model;
          break;
        case 'reviewer':
          model = provider.reviewer_model || provider.default_model;
          break;
        default:
          model = provider.default_model;
      }
    }

    if (!apiKey) {
      throw new Error('未配置 API Key。请在 Config 页面或 .env 中设置。');
    }

    const config: any = {
      modelName: model,
      openAIApiKey: apiKey,
      temperature: 0.7,
    };

    if (baseURL) {
      config.configuration = { baseURL };
    }

    return new ChatOpenAI(config);
  },
};
