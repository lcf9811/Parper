#!/usr/bin/env node
/**
 * WAgent API 测试脚本
 * 测试 Provider 和 Skill 的增删改查接口
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'localhost';
const BASE_PORT = 8787;
const LOG_FILE = `test-api-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

// 日志函数
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// HTTP 请求函数
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: BASE_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 测试函数
async function testEndpoint(method, path, body, description) {
  log('');
  log(`Testing: ${description}`);
  log(`  ${method} ${path}`);
  if (body) {
    log(`  Body: ${JSON.stringify(body)}`);
  }

  try {
    const response = await request(method, path, body);
    if (response.status >= 200 && response.status < 300) {
      log(`  ✓ SUCCESS (Status: ${response.status})`, 'SUCCESS');
      if (response.data) {
        log(`  Response: ${JSON.stringify(response.data, null, 2)}`);
      }
      return response.data;
    } else {
      log(`  ✗ FAILED (Status: ${response.status})`, 'ERROR');
      if (response.data) {
        log(`  Response: ${JSON.stringify(response.data)}`, 'ERROR');
      }
      return null;
    }
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, 'ERROR');
    return null;
  }
}

// 主测试流程
async function runTests() {
  log('========================================');
  log('WAgent API 测试开始');
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

  // 2. 获取现有 Providers
  log('');
  log('--- Test 2: 获取 Provider 列表 ---');
  await testEndpoint('GET', '/api/config/providers', null, 'List Providers');

  // 3. 创建新 Provider
  log('');
  log('--- Test 3: 创建 Provider ---');
  const providerBody = {
    name: 'TestProvider-API',
    api_base_url: 'https://api.test.com/v1',
    api_key: 'sk-test123456',
    default_model: 'gpt-4'
  };
  const newProvider = await testEndpoint('POST', '/api/config/providers', providerBody, 'Create Provider');

  if (newProvider && newProvider.id) {
    const providerId = newProvider.id;
    log(`  Created Provider ID: ${providerId}`);

    // 4. 更新 Provider
    log('');
    log('--- Test 4: 更新 Provider ---');
    const updateBody = {
      name: 'TestProvider-Updated',
      default_model: 'gpt-4-turbo'
    };
    await testEndpoint('PUT', `/api/config/providers/${providerId}`, updateBody, 'Update Provider');

    // 5. 删除 Provider
    log('');
    log('--- Test 5: 删除 Provider ---');
    await testEndpoint('DELETE', `/api/config/providers/${providerId}`, null, 'Delete Provider');
  } else {
    allPassed = false;
  }

  // 6. 获取现有 Skills
  log('');
  log('--- Test 6: 获取 Skill 列表 ---');
  await testEndpoint('GET', '/api/skills', null, 'List Skills');

  // 7. 创建新 Skill
  log('');
  log('--- Test 7: 创建 Skill ---');
  const skillBody = {
    name: 'test-skill-api',
    display_name: 'Test Skill API',
    description: 'A test skill created by API',
    system_prompt: 'You are a test assistant.'
  };
  const newSkill = await testEndpoint('POST', '/api/skills', skillBody, 'Create Skill');

  if (newSkill && newSkill.id) {
    const skillId = newSkill.id;
    log(`  Created Skill ID: ${skillId}`);

    // 8. 更新 Skill
    log('');
    log('--- Test 8: 更新 Skill ---');
    const updateSkillBody = {
      display_name: 'Test Skill Updated',
      system_prompt: 'You are an updated test assistant.'
    };
    await testEndpoint('PUT', `/api/skills/${skillId}`, updateSkillBody, 'Update Skill');

    // 9. 删除 Skill
    log('');
    log('--- Test 9: 删除 Skill ---');
    await testEndpoint('DELETE', `/api/skills/${skillId}`, null, 'Delete Skill');
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

  process.exit(allPassed ? 0 : 1);
}

// 运行测试
runTests().catch(err => {
  log(`测试执行错误: ${err.message}`, 'ERROR');
  process.exit(1);
});
