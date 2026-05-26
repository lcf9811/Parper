#!/usr/bin/env node
/**
 * Webhook UI 功能测试
 * 
 * 版本: Node v22.22.0, Express 4.22.1, Antd 5.29.3
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  BASE_URL: 'localhost',
  BASE_PORT: 8787,
  LOG_DIR: path.join(__dirname, '../logs')
};

const LOG_FILE = path.join(CONFIG.LOG_DIR, `webhook-ui-test-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.BASE_URL,
      port: CONFIG.BASE_PORT,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
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

async function runTests() {
  log('========================================');
  log('Webhook UI 功能测试开始');
  log(`版本: Express 4.22.1, Antd 5.29.3`);
  log('========================================');

  let passed = 0;
  let failed = 0;

  // Test 1: 创建 Webhook 端点
  log('\n--- Test 1: 创建 Webhook 端点 ---');
  try {
    const res = await request('POST', '/api/webhook/endpoints', {
      sessionId: 'test-session-123',
      selectedTools: ['current_time', 'exec_command'],
      selectedSkills: ['general_assistant'],
      description: '测试 Webhook'
    });
    
    if (res.status === 201 && res.data?.webhookUrl && res.data?.bearerKey) {
      log(`✓ Webhook 创建成功`, 'SUCCESS');
      log(`  URL: ${res.data.webhookUrl}`);
      log(`  Bearer Key: ${res.data.bearerKey.substring(0, 8)}...`);
      passed++;
    } else {
      log(`✗ Webhook 创建失败: ${res.status}`, 'ERROR');
      failed++;
    }
  } catch (err) {
    log(`✗ 错误: ${err.message}`, 'ERROR');
    failed++;
  }

  // Test 2: 获取 Webhook 列表
  log('\n--- Test 2: 获取 Webhook 列表 ---');
  try {
    const res = await request('GET', '/api/webhook/endpoints');
    if (res.status === 200 && Array.isArray(res.data)) {
      log(`✓ 获取 Webhook 列表成功: ${res.data.length} 个`, 'SUCCESS');
      passed++;
    } else {
      log(`✗ 获取失败: ${res.status}`, 'ERROR');
      failed++;
    }
  } catch (err) {
    log(`✗ 错误: ${err.message}`, 'ERROR');
    failed++;
  }

  // Test 3: 验证 Bearer Key 格式
  log('\n--- Test 3: 验证 Bearer Key 格式 ---');
  try {
    const res = await request('POST', '/api/webhook/endpoints', {
      sessionId: 'test-session-456',
      selectedTools: [],
      selectedSkills: ['code_reviewer']
    });
    
    if (res.data?.bearerKey) {
      const isValidFormat = /^wh_[a-zA-Z0-9]{32}$/.test(res.data.bearerKey);
      if (isValidFormat) {
        log(`✓ Bearer Key 格式正确`, 'SUCCESS');
        passed++;
      } else {
        log(`✗ Bearer Key 格式不正确: ${res.data.bearerKey}`, 'ERROR');
        failed++;
      }
    }
  } catch (err) {
    log(`✗ 错误: ${err.message}`, 'ERROR');
    failed++;
  }

  // 汇总
  log('\n========================================');
  log(`测试完成: ${passed} 通过, ${failed} 失败`);
  log(`日志: ${LOG_FILE}`);
  log('========================================');

  return failed === 0 ? 0 : 1;
}

runTests().then(code => process.exit(code)).catch(err => {
  log(`测试执行错误: ${err.message}`, 'ERROR');
  process.exit(1);
});
