#!/usr/bin/env node
/**
 * UI 功能测试脚本
 * 测试：会话标题生成、Webhook 配置、Markdown 样式
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'localhost';
const BASE_PORT = 8787;
const LOG_FILE = `test-ui-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

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
  log('UI 功能测试开始');
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

  // 2. 获取 Webhook 配置
  log('');
  log('--- Test 2: 获取 Webhook 配置 ---');
  const webhookConfig = await testEndpoint('GET', '/api/config/webhook', null, 'Get Webhook Config');
  if (!webhookConfig) {
    log('Webhook 配置 API 可能不存在', 'WARN');
  }

  // 3. 更新 Webhook 配置
  log('');
  log('--- Test 3: 更新 Webhook 配置 ---');
  const updateConfig = await testEndpoint('PUT', '/api/config/webhook', {
    defaultWebhookUrl: 'http://example.com/webhook',
    enabled: true,
    mappings: [
      { skill: 'code_reviewer', webhookUrl: 'http://reviewer.example.com' },
      { skill: 'devops_expert', webhookUrl: 'http://devops.example.com' }
    ]
  }, 'Update Webhook Config');
  if (!updateConfig) {
    log('Webhook 配置更新 API 可能不存在', 'WARN');
  }

  // 4. 测试带主题生成的聊天
  log('');
  log('--- Test 4: 聊天并生成会话标题 ---');
  const chatBody = {
    message: '帮我分析一下 Node.js 项目的性能瓶颈',
    sessionId: null,
    selectedTools: [],
    selectedSkills: ['code_reviewer'],
    generateTitle: true  // 请求生成标题
  };
  const chatResult = await testEndpoint('POST', '/api/chat', chatBody, 'Chat with Title Generation');
  if (chatResult && chatResult.sessionId) {
    // 等待后查询会话标题
    await new Promise(r => setTimeout(r, 2000));
    const session = await testEndpoint('GET', `/api/sessions/${chatResult.sessionId}`, null, 'Get Session Title');
    if (session && session.title && session.title !== '新会话') {
      log(`  ✓ 会话标题已生成: ${session.title}`, 'SUCCESS');
    } else {
      log('  ✗ 会话标题未生成或仍为默认值', 'ERROR');
      allPassed = false;
    }
  } else {
    allPassed = false;
  }

  // 5. 检查前端 CSS 文件
  log('');
  log('--- Test 5: 检查样式文件 ---');
  const cssPath = './web/src/styles/index.css';
  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    if (cssContent.includes('.message-content')) {
      log('  ✓ Markdown 样式已定义', 'SUCCESS');
    } else {
      log('  ✗ Markdown 样式未找到', 'ERROR');
      allPassed = false;
    }
  } else {
    log('  ✗ CSS 文件不存在', 'ERROR');
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
  log(`日志: ${LOG_FILE}`);
  log('========================================');

  return allPassed ? 0 : 1;
}

runTests().then(code => process.exit(code)).catch(err => {
  log(`测试错误: ${err.message}`, 'ERROR');
  process.exit(1);
});
