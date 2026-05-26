import { ToolModel } from '../models/toolModel.js';

/** 内置工具定义（后续在 graph 层实例化为 LangChain StructuredTool） */
const BUILT_IN_TOOLS = [
  {
    name: 'current_time',
    displayName: '当前时间',
    description: '返回当前的日期和时间',
    parametersSchema: { type: 'object', properties: {} },
  },
  {
    name: 'knowledge_lookup',
    displayName: '知识检索',
    description: '在知识库中搜索相关内容',
    parametersSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: '搜索关键词' } },
      required: ['query'],
    },
  },
  {
    name: 'skill_catalog',
    displayName: '技能目录',
    description: '列出所有可用的技能',
    parametersSchema: { type: 'object', properties: {} },
  },
  {
    name: 'exec_command',
    displayName: '执行命令',
    description: '执行本地 CLI 命令和脚本，如检查系统信息、操作文件等',
    parametersSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        timeout: { type: 'number', description: '超时时间（毫秒）', default: 30000 },
        workingDir: { type: 'string', description: '工作目录' },
      },
      required: ['command'],
    },
  },
  {
    name: 'filesystem_mcp',
    displayName: '文件系统 MCP',
    description: '通过 MCP 协议访问本地文件系统',
    parametersSchema: {
      type: 'object',
      mcpType: 'filesystem',
      properties: {
        operation: { type: 'string', enum: ['read', 'write', 'list', 'exists'], description: '操作类型' },
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '写入内容（write操作需要）' },
      },
      required: ['operation', 'path'],
    },
  },
  {
    name: 'http_api',
    displayName: 'HTTP API 调用',
    description: '调用 Skill 声明的 Web API 能力（如查询 SCADA 数据、获取传感器读数等）',
    parametersSchema: {
      type: 'object',
      properties: {
        capability_name: { type: 'string', description: '能力名称，如 query_scada_data' },
        parameters: { type: 'object', description: 'API 调用参数' },
      },
      required: ['capability_name'],
    },
  },
  {
    name: 'python_runner',
    displayName: 'Python 脚本执行',
    description: '执行 Skill 声明的 Python 脚本能力（如计算加药量、水质分析等）',
    parametersSchema: {
      type: 'object',
      properties: {
        capability_name: { type: 'string', description: '能力名称，如 calculate_carbon_source' },
        parameters: { type: 'object', description: '脚本输入参数' },
      },
      required: ['capability_name'],
    },
  },
  {
    name: 'capability_lookup',
    displayName: '能力查询',
    description: '列出所有已注册的外部能力（Web API 和 Python 脚本）',
    parametersSchema: {
      type: 'object',
      properties: {
        skill_name: { type: 'string', description: '按技能名称过滤（可选）' },
      },
    },
  },
];

export const toolRegistry = {
  /** 启动时：确保内置工具已注册到数据库 */
  async initialize() {
    for (const t of BUILT_IN_TOOLS) {
      await ToolModel.upsert(t.name, t.displayName, t.description, t.parametersSchema, true);
    }
    console.log('[ToolRegistry] 内置工具已同步');
  },

  async listTools() {
    return ToolModel.findAll();
  },

  async getEnabledTools() {
    return ToolModel.findEnabled();
  },

  async toggleTool(id: string, enabled: boolean) {
    return ToolModel.toggleEnabled(id, enabled);
  },

  /** 按名称列表过滤可用工具 */
  async getToolsByNames(names: string[]) {
    const all = await ToolModel.findEnabled();
    if (names.length === 0) return all;
    return all.filter(t => names.includes(t.name));
  },
};
