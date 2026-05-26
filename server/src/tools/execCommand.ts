/**
 * 本地命令执行工具
 * 允许 Agent 执行本地 CLI 命令和脚本
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// 命令执行配置
const ALLOWED_COMMANDS = [
  'echo', 'cat', 'ls', 'dir', 'pwd', 'cd', 'find', 'grep',
  'head', 'tail', 'wc', 'date', 'whoami', 'hostname',
  'ipconfig', 'ping', 'curl', 'node', 'npm', 'git', 'python'
];

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  />\s*\/dev\/null/,
  /&\s*rm/,
  /\|\s*rm/,
  /;\s*rm/,
  /wget.*\|.*sh/,
  /curl.*\|.*sh/,
];

/**
 * 验证命令安全性
 */
function validateCommand(command: string): { valid: boolean; reason?: string } {
  // 检查是否有危险模式
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { valid: false, reason: 'Command contains dangerous pattern' };
    }
  }

  // 提取命令名（第一个词）
  const cmdName = command.trim().split(/\s+/)[0].toLowerCase();
  
  // 检查是否在允许列表中
  if (!ALLOWED_COMMANDS.includes(cmdName)) {
    return { 
      valid: false, 
      reason: `Command '${cmdName}' is not in allowed list. Allowed: ${ALLOWED_COMMANDS.join(', ')}` 
    };
  }

  return { valid: true };
}

/**
 * 执行本地命令
 */
async function executeCommand(
  command: string,
  timeout: number = 30000,
  workingDir?: string
): Promise<string> {
  // 安全验证
  const validation = validateCommand(command);
  if (!validation.valid) {
    throw new Error(`Command validation failed: ${validation.reason}`);
  }

  const options: any = {
    timeout,
    windowsHide: true,
  };

  if (workingDir) {
    options.cwd = path.resolve(workingDir);
  }

  try {
    const { stdout, stderr } = await execAsync(command, options);
    
    let result = '';
    if (stdout) result += `STDOUT:\n${stdout}\n`;
    if (stderr) result += `STDERR:\n${stderr}\n`;
    
    return result || 'Command executed successfully (no output)';
  } catch (error: any) {
    if (error.killed) {
      throw new Error(`Command timed out after ${timeout}ms`);
    }
    
    let result = `Exit code: ${error.code}\n`;
    if (error.stdout) result += `STDOUT:\n${error.stdout}\n`;
    if (error.stderr) result += `STDERR:\n${error.stderr}\n`;
    
    return result;
  }
}

/**
 * exec_command 工具定义
 */
export const execCommandTool = tool(
  async (input: { command: string; timeout?: number; workingDir?: string }) => {
    const { command, timeout = 30000, workingDir } = input;
    
    console.log(`[ExecCommand] Executing: ${command}`);
    
    try {
      const result = await executeCommand(command, timeout, workingDir);
      console.log(`[ExecCommand] Success`);
      return result;
    } catch (error: any) {
      console.error(`[ExecCommand] Error: ${error.message}`);
      throw error;
    }
  },
  {
    name: 'exec_command',
    description: `Execute local CLI commands and scripts. 
Allowed commands: ${ALLOWED_COMMANDS.join(', ')}
Use this to: check system info, list files, run scripts, check network, etc.`,
    schema: z.object({
      command: z.string().describe('The command to execute'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
      workingDir: z.string().optional().describe('Working directory for command execution'),
    }),
  }
);

export default execCommandTool;
