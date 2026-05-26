/**
 * MCP (Model Context Protocol) 工具支持
 * 允许 Agent 调用符合 MCP 协议的外部工具
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ToolModel } from '../models/toolModel.js';

/**
 * MCP 工具调用结果
 */
interface MCPResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 文件系统 MCP 工具实现
 */
async function filesystemMCP(operation: string, path: string, content?: string): Promise<MCPResult> {
  const fs = await import('fs/promises');
  const nodePath = await import('path');
  
  try {
    const resolvedPath = nodePath.resolve(path);
    
    // 安全检查：限制在特定目录内
    const allowedBase = process.cwd();
    if (!resolvedPath.startsWith(allowedBase)) {
      return { success: false, error: 'Path outside allowed directory' };
    }

    switch (operation) {
      case 'read': {
        const data = await fs.readFile(resolvedPath, 'utf-8');
        return { success: true, data };
      }
      
      case 'write': {
        if (content === undefined) {
          return { success: false, error: 'Content required for write operation' };
        }
        await fs.writeFile(resolvedPath, content, 'utf-8');
        return { success: true, data: 'File written successfully' };
      }
      
      case 'list': {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const result = entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
          isFile: e.isFile(),
          isDirectory: e.isDirectory(),
        }));
        return { success: true, data: result };
      }
      
      case 'exists': {
        try {
          await fs.access(resolvedPath);
          return { success: true, data: true };
        } catch {
          return { success: true, data: false };
        }
      }
      
      default:
        return { success: false, error: `Unknown operation: ${operation}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * HTTP MCP 工具实现
 */
async function httpMCP(url: string, method: string = 'GET', body?: string, headers?: Record<string, string>): Promise<MCPResult> {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const options: any = {
      method: method.toUpperCase(),
      headers: headers || { 'Content-Type': 'application/json' },
    };
    
    if (body && method.toUpperCase() !== 'GET') {
      options.body = body;
    }
    
    const response = await fetch(url, options);
    const data = await response.text();
    
    return {
      success: response.ok,
      data: {
        status: response.status,
        statusText: response.statusText,
        body: data,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 创建动态 MCP 工具
 */
export function createMcpTool(toolName: string, toolConfig: any) {
  return tool(
    async (input: any) => {
      console.log(`[MCP Tool] ${toolName} called with:`, JSON.stringify(input));
      
      try {
        let result: MCPResult;
        
        switch (toolConfig.mcpType) {
          case 'filesystem':
            result = await filesystemMCP(input.operation, input.path, input.content);
            break;
            
          case 'http':
            result = await httpMCP(input.url, input.method, input.body, input.headers);
            break;
            
          default:
            // 通用 MCP 调用
            result = await callGenericMCP(toolConfig.endpoint, input);
        }
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        return JSON.stringify(result.data, null, 2);
      } catch (error: any) {
        console.error(`[MCP Tool] Error:`, error.message);
        throw error;
      }
    },
    {
      name: toolName,
      description: toolConfig.description || `MCP tool: ${toolName}`,
      schema: z.object(toolConfig.schema || {}),
    }
  );
}

/**
 * 调用通用 MCP 端点
 */
async function callGenericMCP(endpoint: string, input: any): Promise<MCPResult> {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'invoke',
        params: input,
        id: Date.now(),
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error.message };
    }
    
    return { success: true, data: data.result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 从数据库加载 MCP 工具
 */
export async function loadMcpTools(): Promise<Map<string, any>> {
  const tools = new Map<string, any>();
  
  try {
    const mcpTools = await ToolModel.findByMcpType('filesystem');
    
    for (const toolConfig of mcpTools) {
      const tool = createMcpTool(toolConfig.name, {
        mcpType: 'filesystem',
        description: toolConfig.description,
        schema: toolConfig.parameters_schema || {
          operation: z.enum(['read', 'write', 'list', 'exists']),
          path: z.string(),
          content: z.string().optional(),
        },
      });
      
      tools.set(toolConfig.name, tool);
    }
    
    console.log(`[MCP] Loaded ${tools.size} MCP tools`);
  } catch (error) {
    console.error('[MCP] Failed to load tools:', error);
  }
  
  return tools;
}

export default { createMcpTool, loadMcpTools };
