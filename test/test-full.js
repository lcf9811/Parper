#!/usr/bin/env node
/**
 * 完整功能测试脚本
 * 测试：
 * 1. 健康检查
 * 2. 本地 Skill 文件扫描
 * 3. Webhook 接收
 * 4. 工具列表
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'localhost';
const BASE_PORT = 8787;
const LOG_FILE = `test-full-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

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
  log('完整功能测试开始');
  log(`Base URL: http://${BASE_URL}:${BASE_PORT}`);
  log('========================================');

  let allPassed = true;

  // 1. 健康检查
  log('');
  log('--- Test 1: 健康检查 ---');
  const health = await testEndpoint('GET', '/api/health', null, 'Health Check');
  if (!health) {
    log('健康检查失败，停止测试', 'ERROR');
    return 1;
  }

  // 2. 获取 Skills（验证本地 skill 已加载）
  log('');
  log('--- Test 2: 获取 Skills（验证本地 SKILL.md 已扫描）---');
  const skills = await testEndpoint('GET', '/api/skills', null, 'List Skills');
  if (skills) {
    const localSkills = skills.filter(s => s.name === 'code_reviewer' || s.name === 'devops_expert');
    log(`  本地 Skills 数量: ${localSkills.length}`);
    if (localSkills.length === 0) {
      log('  ✗ 本地 Skill 文件未扫描到！', 'ERROR');
      allPassed = false;
    } else {
      log('  ✓ 本地 Skill 文件已自动扫描', 'SUCCESS');
      localSkills.forEach(s => log(`    - ${s.name}: ${s.display_name}`));
    }
  } else {
    allPassed = false;
  }

  // 3. 获取工具列表（验证新工具）
  log('');
  log('--- Test 3: 获取工具列表（验证 exec_command 和 filesystem_mcp）---');
  const tools = await testEndpoint('GET', '/api/tools', null, 'List Tools');
  if (tools) {
    const execTool = tools.find(t => t.name === 'exec_command');
    const mcpTool = tools.find(t => t.name === 'filesystem_mcp');
    if (execTool && mcpTool) {
      log('  ✓ exec_command 和 filesystem_mcp 工具已注册', 'SUCCESS');
    } else {
      log('  ✗ 新工具未找到！', 'ERROR');
      allPassed = false;
    }
  } else {
    allPassed = false;
  }

  // 4. 测试 Webhook
  log('');
  log('--- Test 4: Webhook 接收 ---');
  const webhookBody = {
    message: 'Hello from Webhook',
    sessionId: null,
    selectedTools: [],
    selectedSkills: ['general_assistant'],
  };
  const webhookResult = await testEndpoint('POST', '/api/webhook/chat', webhookBody, 'Webhook Chat');
  if (!webhookResult || !webhookResult.sessionId) {
    allPassed = false;
  }

  // 5. 刷新本地 Skills
  log('');
  log('--- Test 5: 刷新本地 Skills ---');
  const reloadResult = await testEndpoint('POST', '/api/skills/reload', null, 'Reload Local Skills');
  if (reloadResult) {
    log('  ✓ Skills 刷新成功', 'SUCCESS');
  } else {
    allPassed = false;
  }

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

  return allPassed ? 0 : 1;
}

runTests().then(code => process.exit(code)).catch(err => {
  log(`测试执行错误: ${err.message}`, 'ERROR');
  process.exit(1);
});
