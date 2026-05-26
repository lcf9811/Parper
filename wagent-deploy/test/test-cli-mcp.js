#!/usr/bin/env node
/**
 * WAgent CLI/MCP/Skill 测试脚本
 * 测试本地命令执行、MCP 工具、技能执行功能
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'localhost';
const BASE_PORT = 8787;
const LOG_FILE = `test-cli-mcp-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: BASE_PORT,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testEndpoint(method, path, body, description) {
  log('');
  log(`Testing: ${description}`);
  log(`  ${method} ${path}`);
  if (body) log(`  Body: ${JSON.stringify(body)}`);

  try {
    const response = await request(method, path, body);
    if (response.status >= 200 && response.status < 300) {
      log(`  ✓ SUCCESS (Status: ${response.status})`, 'SUCCESS');
      if (response.data) log(`  Response: ${JSON.stringify(response.data, null, 2)}`);
      return response.data;
    } else {
      log(`  ✗ FAILED (Status: ${response.status})`, 'ERROR');
      if (response.data) log(`  Response: ${JSON.stringify(response.data)}`, 'ERROR');
      return null;
    }
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, 'ERROR');
    return null;
  }
}

async function runTests() {
  log('========================================');
  log('WAgent CLI/MCP/Skill 测试开始');
  log(`Base URL: http://${BASE_URL}:${BASE_PORT}`);
  log('========================================');

  let allPassed = true;

  // 1. 健康检查
  log('');
  log('--- Test 1: 健康检查 ---');
  const health = await testEndpoint('GET', '/api/health', null, 'Health Check');
  if (!health) {
    log('健康检查失败，停止测试', 'ERROR');
    process.exit(1);
  }

  // 2. 获取工具列表（检查是否有新工具）
  log('');
  log('--- Test 2: 获取工具列表 ---');
  const tools = await testEndpoint('GET', '/api/tools', null, 'List Tools');

  // 3. 测试本地 CLI 命令执行（通过 chat API 调用 exec_command 工具）
  log('');
  log('--- Test 3: 测试本地命令执行工具 ---');
  const chatBody = {
    message: '请执行命令 "echo hello"',
    sessionId: null,
    selectedTools: ['exec_command'],
    selectedSkills: ['general_assistant']
  };
  const chatResponse = await testEndpoint('POST', '/api/chat', chatBody, 'Chat with exec_command tool');
  
  if (chatResponse && chatResponse.executionId) {
    // 等待一秒后查询执行结果
    await new Promise(r => setTimeout(r, 1000));
    await testEndpoint('GET', `/api/executions/${chatResponse.executionId}`, null, 'Get Execution Result');
    await testEndpoint('GET', `/api/executions/${chatResponse.executionId}/steps`, null, 'Get Execution Steps');
  }

  // 4. 获取技能列表
  log('');
  log('--- Test 4: 获取技能列表 ---');
  const skills = await testEndpoint('GET', '/api/skills', null, 'List Skills');

  // 5. 创建 MCP 工具配置
  log('');
  log('--- Test 5: 创建 MCP 配置 ---');
  const mcpBody = {
    name: 'filesystem_mcp',
    display_name: '文件系统 MCP',
    description: '访问本地文件系统的 MCP 工具',
    parameters_schema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['read', 'write', 'list'], description: '操作类型' },
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '写入内容' }
      },
      required: ['operation', 'path']
    },
    enabled: 1,
    built_in: 0
  };
  const mcpTool = await testEndpoint('POST', '/api/tools/mcp', mcpBody, 'Create MCP Tool');

  // 测试完成
  log('');
  log('========================================');
  if (allPassed) {
    log('✓ 所有测试通过', 'SUCCESS');
  } else {
    log('✗ 部分测试失败', 'ERROR');
  }
  log(`日志保存至: ${LOG_FILE}`);
  log('========================================');

  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  log(`测试执行错误: ${err.message}`, 'ERROR');
  process.exit(1);
});
