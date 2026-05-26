/**
 * HTTP API 调用工具
 * 根据 Capability 配置执行 HTTP 请求
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { capabilityRegistry } from '../services/capabilityRegistry.js';

/**
 * 执行 HTTP API 调用
 */
export async function executeHttpApi(capabilityName: string, parameters?: Record<string, any>): Promise<string> {
  // 1. 查找 capability
  const cap = capabilityRegistry.findByName(capabilityName);
  if (!cap) {
    throw new Error(`Capability '${capabilityName}' not found`);
  }
  if (cap.type !== 'web_api') {
    throw new Error(`Capability '${capabilityName}' is not a web_api type`);
  }
  if (!cap.enabled) {
    throw new Error(`Capability '${capabilityName}' is disabled`);
  }

  const config = cap.config as import('../services/capabilityRegistry.js').WebApiConfig;

  // 2. 验证域名白名单
  let requestUrl: string = config.url;
  let urlObj: URL;
  try {
    urlObj = new URL(config.url);
  } catch {
    throw new Error(`Invalid URL for capability '${capabilityName}': ${config.url}`);
  }

  if (!capabilityRegistry.isDomainAllowed(urlObj.hostname)) {
    throw new Error(
      `Domain '${urlObj.hostname}' is not in the allowed list. ` +
      `Allowed domains: ${capabilityRegistry.getDomainWhitelist().join(', ')}`
    );
  }

  // 3. 处理 headers（替换环境变量）
  const headers: Record<string, string> = {};
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      headers[key] = capabilityRegistry.replaceEnvVars(String(value));
    }
  }
  if (!headers['Content-Type'] && config.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  // 4. 处理参数
  const params: Record<string, any> = {};
  for (const paramDef of config.parameters) {
    const val = parameters?.[paramDef.name] ?? paramDef.default;
    if (paramDef.required && val === undefined) {
      throw new Error(`Missing required parameter '${paramDef.name}' for capability '${capabilityName}'`);
    }
    if (val !== undefined) {
      params[paramDef.name] = val;
    }
  }

  // 5. 构建请求
  const method = config.method || 'GET';
  let fetchUrl = requestUrl;
  let body: string | undefined;

  if (method === 'GET') {
    const queryParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      queryParams.append(key, String(val));
    }
    const queryString = queryParams.toString();
    if (queryString) {
      fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + queryString;
    }
  } else {
    body = JSON.stringify(params);
  }

  // 6. 发送请求
  console.log(`[HttpApi] ${method} ${fetchUrl}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(fetchUrl, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // 7. 解析响应
    const contentType = response.headers.get('content-type') || '';
    let data: any;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    // 8. 格式化结果
    const formatted = capabilityRegistry.formatApiResponse(data, config.response_mapping);
    console.log(`[HttpApi] Success for '${capabilityName}'`);
    return formatted;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after 30000ms`);
    }
    throw err;
  }
}

/**
 * http_api 工具定义
 */
export const httpApiTool = tool(
  async (input: { capability_name: string; parameters?: Record<string, any> }) => {
    const { capability_name, parameters } = input;
    return executeHttpApi(capability_name, parameters);
  },
  {
    name: 'http_api',
    description: `调用已配置的 Web API 能力。
用法：传入 capability_name（能力名称）和 parameters（参数）。
系统会根据 SKILL.md 中声明的配置自动构建 HTTP 请求。`,
    schema: z.object({
      capability_name: z.string().describe('要调用的能力名称，如 query_scada_data'),
      parameters: z.record(z.any()).optional().describe('API 调用参数，根据能力定义传入'),
    }),
  }
);

export default httpApiTool;
