/**
 * 能力注册表（Capability Registry）
 * 管理所有 Skill 声明的外部能力调用（Web API + Python 脚本）
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_BASE_DIR = path.resolve(__dirname, '../../../scripts');
const PROJECT_ROOT = path.dirname(SCRIPTS_BASE_DIR);

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default?: any;
  description: string;
}

export interface WebApiConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  parameters: ParameterDefinition[];
  response_mapping?: Record<string, string>;
}

export interface PythonScriptConfig {
  script: string;
  parameters: ParameterDefinition[];
  output_format?: 'json' | 'table' | 'text';
}

export interface Capability {
  id: string;              // 自动生成: "skill-name:capability-name"
  skillName: string;       // 所属技能
  type: 'web_api' | 'python_script';
  name: string;            // 能力名称
  description: string;     // 能力描述（注入 system prompt）
  enabled: boolean;        // 是否启用
  config: WebApiConfig | PythonScriptConfig;
}

// 内存中的能力注册表
const capabilities = new Map<string, Capability>();

// 域名白名单（可配置）
let domainWhitelist: string[] = ['localhost', '127.0.0.1'];

export const capabilityRegistry = {
  /**
   * 从 SKILL.md frontmatter 解析 capabilities
   */
  parseFromFrontmatter(skillName: string, rawCapabilities: any[]): Capability[] {
    if (!Array.isArray(rawCapabilities)) return [];

    const result: Capability[] = [];
    for (const raw of rawCapabilities) {
      if (!raw || typeof raw !== 'object') continue;

      const type = raw.type;
      if (type !== 'web_api' && type !== 'python_script') {
        console.warn(`[CapabilityRegistry] Unknown capability type: ${type}, skipping`);
        continue;
      }

      const cap: Capability = {
        id: `${skillName}:${raw.name}`,
        skillName,
        type,
        name: raw.name || '',
        description: raw.description || '',
        enabled: true,
        config: this.parseConfig(type, raw),
      };

      result.push(cap);
    }

    return result;
  },

  parseConfig(type: 'web_api' | 'python_script', raw: any): WebApiConfig | PythonScriptConfig {
    if (type === 'web_api') {
      return {
        url: raw.url || '',
        method: (raw.method || 'GET').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE',
        headers: raw.headers || {},
        parameters: this.parseParameters(raw.parameters),
        response_mapping: raw.response_mapping || {},
      };
    } else {
      // Normalize script path to absolute to avoid CWD-dependent resolution
      let scriptPath = raw.script || '';
      if (scriptPath && !path.isAbsolute(scriptPath)) {
        scriptPath = path.resolve(PROJECT_ROOT, scriptPath);
      }
      return {
        script: scriptPath,
        parameters: this.parseParameters(raw.parameters),
        output_format: raw.output_format || 'json',
      };
    }
  },

  parseParameters(rawParams: any[]): ParameterDefinition[] {
    if (!Array.isArray(rawParams)) return [];
    return rawParams.map(p => ({
      name: p.name || '',
      type: p.type || 'string',
      required: p.required !== false,
      default: p.default,
      description: p.description || '',
    }));
  },

  /**
   * 注册技能的 capabilities
   */
  registerSkillCapabilities(skillName: string, caps: Capability[]) {
    for (const cap of caps) {
      capabilities.set(cap.id, cap);
    }
  },

  /**
   * 获取指定 capability
   */
  getById(id: string): Capability | undefined {
    return capabilities.get(id);
  },

  /**
   * 按技能名+能力名获取
   */
  getByName(skillName: string, name: string): Capability | undefined {
    return capabilities.get(`${skillName}:${name}`);
  },

  /**
   * 按能力名称模糊查找（用于工具调用时 LLM 只传了 name）
   */
  findByName(name: string): Capability | undefined {
    for (const cap of capabilities.values()) {
      if (cap.name === name) return cap;
    }
    return undefined;
  },

  /**
   * 列出所有 capabilities（可按技能过滤）
   */
  list(skillName?: string): Capability[] {
    const all = Array.from(capabilities.values());
    if (skillName) {
      return all.filter(c => c.skillName === skillName);
    }
    return all;
  },

  /**
   * 按技能列出 capabilities
   */
  listBySkillNames(skillNames: string[]): Capability[] {
    return Array.from(capabilities.values()).filter(c => skillNames.includes(c.skillName) && c.enabled);
  },

  /**
   * 启用/禁用 capability
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const cap = capabilities.get(id);
    if (!cap) return false;
    cap.enabled = enabled;
    return true;
  },

  /**
   * 清除所有注册（主要用于测试或重新加载）
   */
  clear() {
    capabilities.clear();
  },

  /**
   * 生成 capabilities 描述文本（注入 system prompt）
   */
  buildCapabilityGuidance(caps: Capability[]): string {
    if (caps.length === 0) return '';

    const lines: string[] = [];
    lines.push('## 扩展能力调用');
    lines.push('');
    lines.push('你可以调用以下外部能力来获取数据或执行计算：');
    lines.push('');

    for (const cap of caps) {
      lines.push(`### ${cap.name}`);
      lines.push(`类型: ${cap.type === 'web_api' ? 'Web API' : 'Python 脚本'}`);
      lines.push(`描述: ${cap.description}`);

      if (cap.config.parameters.length > 0) {
        lines.push('参数:');
        for (const p of cap.config.parameters) {
          const req = p.required ? '(必填)' : '(可选)';
          const def = p.default !== undefined ? `, 默认值: ${p.default}` : '';
          lines.push(`  - ${p.name}: ${p.description} ${req}${def}`);
        }
      }

      if (cap.type === 'web_api') {
        const cfg = cap.config as WebApiConfig;
        lines.push(`URL: ${cfg.method} ${cfg.url}`);
      } else {
        const cfg = cap.config as PythonScriptConfig;
        lines.push(`脚本: ${cfg.script}`);
      }

      lines.push('');
    }

    lines.push('调用方式：');
    lines.push('- 调用 Web API: 使用 `http_api` 工具，传入 `capability_name` 和 `parameters`');
    lines.push('- 调用 Python 脚本: 使用 `python_runner` 工具，传入 `capability_name` 和 `parameters`');
    lines.push('');

    return lines.join('\n');
  },

  /**
   * 格式化 API 响应（按 response_mapping）
   */
  formatApiResponse(data: any, mapping?: Record<string, string>): string {
    if (!mapping || Object.keys(mapping).length === 0) {
      return JSON.stringify(data, null, 2);
    }

    const lines: string[] = ['API 调用结果:'];
    for (const [key, label] of Object.entries(mapping)) {
      const value = this.getNestedValue(data, key);
      lines.push(`${label}: ${value !== undefined ? value : 'N/A'}`);
    }
    return lines.join('\n');
  },

  /**
   * 格式化 Python 脚本输出
   */
  formatScriptOutput(data: any, format: 'json' | 'table' | 'text' = 'json'): string {
    if (format === 'text') {
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
    if (format === 'table' && typeof data === 'object' && data !== null) {
      const lines: string[] = ['计算结果:'];
      for (const [key, value] of Object.entries(data)) {
        lines.push(`| ${key} | ${value} |`);
      }
      return lines.join('\n');
    }
    return JSON.stringify(data, null, 2);
  },

  getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  },

  /**
   * 替换字符串中的环境变量 ${ENV_VAR}
   */
  replaceEnvVars(str: string): string {
    return str.replace(/\$\{(\w+)\}/g, (_match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        console.warn(`[CapabilityRegistry] Environment variable ${varName} not found`);
        return '';
      }
      return value;
    });
  },

  /**
   * 验证域名是否在白名单中
   */
  isDomainAllowed(domain: string): boolean {
    // 移除端口
    const hostname = domain.split(':')[0];
    return domainWhitelist.some(w => {
      if (w === hostname) return true;
      if (w.startsWith('*.')) {
        const suffix = w.slice(2);
        return hostname.endsWith(suffix);
      }
      return false;
    });
  },

  /**
   * 设置域名白名单
   */
  setDomainWhitelist(domains: string[]) {
    domainWhitelist = domains;
  },

  getDomainWhitelist(): string[] {
    return [...domainWhitelist];
  },

  /**
   * 验证脚本路径安全性（脚本路径已标准化为绝对路径）
   */
  validateScriptPath(scriptPath: string): { valid: boolean; reason?: string } {
    const allowedBase = path.resolve(SCRIPTS_BASE_DIR);
    if (!scriptPath.startsWith(allowedBase)) {
      return { valid: false, reason: `Script must be under scripts/ directory. Got: ${scriptPath}` };
    }
    return { valid: true };
  },
};
