/**
 * Python 脚本执行工具
 * 根据 Capability 配置执行 Python 脚本
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { capabilityRegistry } from '../services/capabilityRegistry.js';

// 危险函数黑名单（静态分析用）
const DANGEROUS_PATTERNS = [
  /\bos\.system\b/,
  /\bos\.popen\b/,
  /\bsubprocess\b/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bcompile\s*\(/,
  /\b__import__\s*\(/,
  /\bopen\s*\(\s*['"]\//,
];

/**
 * 使用 spawn 执行 Python 脚本，支持 stdin 传参
 */
function runPythonScript(scriptPath: string, input: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [scriptPath], {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeoutMs);

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    proc.on('close', (exitCode, signal) => {
      clearTimeout(timeoutId);
      if (timedOut || signal === 'SIGTERM') {
        reject(new Error(`Script timed out after ${timeoutMs}ms`));
        return;
      }
      resolve({ stdout, stderr, exitCode: exitCode ?? null });
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

/**
 * 静态分析脚本安全性
 */
async function validateScriptSafety(scriptPath: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const content = await fs.readFile(scriptPath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 跳过注释行
      const codePart = line.split('#')[0];
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(codePart)) {
          return {
            valid: false,
            reason: `Dangerous pattern detected at line ${i + 1}: ${codePart.trim().substring(0, 60)}`,
          };
        }
      }
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `Failed to read script: ${err.message}` };
  }
}

/**
 * 执行 Python 脚本
 */
export async function executePythonScript(
  capabilityName: string,
  parameters?: Record<string, any>
): Promise<string> {
  // 1. 查找 capability
  const cap = capabilityRegistry.findByName(capabilityName);
  if (!cap) {
    throw new Error(`Capability '${capabilityName}' not found`);
  }
  if (cap.type !== 'python_script') {
    throw new Error(`Capability '${capabilityName}' is not a python_script type`);
  }
  if (!cap.enabled) {
    throw new Error(`Capability '${capabilityName}' is disabled`);
  }

  const config = cap.config as import('../services/capabilityRegistry.js').PythonScriptConfig;

  // 2. 验证脚本路径
  const pathValidation = capabilityRegistry.validateScriptPath(config.script);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.reason);
  }

  // 检查文件是否存在
  try {
    await fs.access(config.script);
  } catch {
    throw new Error(`Script not found: ${config.script}`);
  }

  // 3. 安全校验
  const safety = await validateScriptSafety(config.script);
  if (!safety.valid) {
    throw new Error(`Script security check failed: ${safety.reason}`);
  }

  // 4. 准备参数
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

  // 5. 执行脚本
  const input = JSON.stringify(params);
  console.log(`[PythonRunner] Executing: ${config.script} with params: ${input}`);

  const { stdout, stderr, exitCode } = await runPythonScript(config.script, input);

  if (stderr) {
    console.warn(`[PythonRunner] stderr: ${stderr}`);
  }

  if (exitCode !== 0) {
    throw new Error(`Script execution failed with exit code ${exitCode}: ${stderr || stdout || 'Unknown error'}`);
  }

  // 6. 解析输出
  const output = (stdout || '').toString().trim();
  if (!output) {
    return 'Script executed successfully (no output)';
  }

  let data: any;
  try {
    data = JSON.parse(output);
  } catch {
    // 非 JSON 输出，直接返回文本
    return capabilityRegistry.formatScriptOutput(output, config.output_format);
  }

  // 7. 格式化结果
  const formatted = capabilityRegistry.formatScriptOutput(data, config.output_format);
  console.log(`[PythonRunner] Success for '${capabilityName}'`);
  return formatted;
}

/**
 * python_runner 工具定义
 */
export const pythonRunnerTool = tool(
  async (input: { capability_name: string; parameters?: Record<string, any> }) => {
    const { capability_name, parameters } = input;
    return executePythonScript(capability_name, parameters);
  },
  {
    name: 'python_runner',
    description: `执行已配置的 Python 脚本能力。
用法：传入 capability_name（能力名称）和 parameters（参数）。
系统会根据 SKILL.md 中声明的配置自动执行对应的 Python 脚本。`,
    schema: z.object({
      capability_name: z.string().describe('要执行的能力名称，如 calculate_carbon_source'),
      parameters: z.record(z.any()).optional().describe('脚本输入参数，根据能力定义传入'),
    }),
  }
);

export default pythonRunnerTool;
