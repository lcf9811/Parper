#!/usr/bin/env node
/**
 * Webhook 和 Skill 测试脚本
 * 测试 webhook 接收和 skill 文件加载功能
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'localhost';
const BASE_PORT = 8787;
const LOG_FILE = `test-webhook-skill-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

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
  log('Webhook & Skill 测试开始');
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

  // 2. 获取 Skills（检查本地 skill 文件是否加载）
  log('');
  log('--- Test 2: 获取 Skill 列表（含本地 SKILL.md） ---');
  const skills = await testEndpoint('GET', '/api/skills', null, 'List Skills with Local SKILL.md');
  
  if (skills) {
    const localSkills = skills.filter(s => s.source === 'local');
    log(`  本地 Skill 数量: ${localSkills.length}`);
    localSkills.forEach(s => log(`    - ${s.name}: ${s.display_name}`));
  }

  // 3. 测试 Webhook 接收
  log('');
  log('--- Test 3: Webhook 接收消息 ---');
  const webhookBody = {
    message: '查询当前系统状态',
    sessionId: null,
    selectedTools: ['current_time', 'exec_command'],
    selectedSkills: ['general_assistant'],
    webhookUrl: null  // 可选的回调地址
  };
  const webhookResponse = await testEndpoint('POST', '/api/webhook/chat', webhookBody, 'Webhook Chat');
  
  if (webhookResponse && webhookResponse.executionId) {
    // 等待执行完成
    log('  等待执行完成...');
    await new Promise(r => setTimeout(r, 3000));
    
    // 查询执行结果
    await testEndpoint('GET', `/api/executions/${webhookResponse.executionId}`, null, 'Get Execution Result');
    await testEndpoint('GET', `/api/executions/${webhookResponse.executionId}/steps`, null, 'Get Execution Steps');
  } else {
    allPassed = false;
  }

  // 4. 测试 Webhook 带回调
  log('');
  log('--- Test 4: Webhook 带回调 URL ---');
  const webhookWithCallback = {
    message: '执行命令 echo "Hello from Webhook"',
    sessionId: null,
    selectedTools: ['exec_command'],
    selectedSkills: ['general_assistant'],
    webhookUrl: 'http://localhost:8787/api/webhook/callback-test'
  };
  await testEndpoint('POST', '/api/webhook/chat', webhookWithCallback, 'Webhook with Callback');

  // 5. 强制刷新本地 Skills
  log('');
  log('--- Test 5: 强制刷新本地 Skills ---');
  await testEndpoint('POST', '/api/skills/reload', null, 'Reload Local Skills');

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
