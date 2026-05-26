#!/usr/bin/env node
/**
 * WAgent 完整测试套件
 * 
 * 版本信息：
 * - Node.js: v22.22.0
 * - React: 18.3.1
 * - Ant Design: 5.29.3
 * - Vite: 6.4.2
 * - Express: 4.22.1
 * - LangChain Core: 0.3.80
 * - MySQL2: 3.20.0
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  BASE_URL: 'localhost',
  BASE_PORT: 8787,
  LOG_DIR: path.join(__dirname, '../logs'),
  TIMEOUT: 10000
};

// 确保日志目录存在
if (!fs.existsSync(CONFIG.LOG_DIR)) {
  fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
}

const LOG_FILE = path.join(CONFIG.LOG_DIR, `test-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

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
      headers: { 'Content-Type': 'application/json' },
      timeout: CONFIG.TIMEOUT
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

class TestRunner {
  constructor() {
    this.results = { passed: 0, failed: 0, tests: [] };
  }

  async runTest(name, testFn) {
    log(`\n--- ${name} ---`);
    try {
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED' });
      log(`✓ ${name} 通过`, 'SUCCESS');
    } catch (err) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: err.message });
      log(`✗ ${name} 失败: ${err.message}`, 'ERROR');
    }
  }

  async assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  async assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
}

async function runTests() {
  log('========================================');
  log('WAgent 测试套件开始');
  log(`版本: Node v22.22.0, React 18.3.1, Express 4.22.1`);
  log(`日志: ${LOG_FILE}`);
  log('========================================');

  const runner = new TestRunner();

  // Test 1: 健康检查
  await runner.runTest('健康检查', async () => {
    const res = await request('GET', '/api/health');
    await runner.assertEquals(res.status, 200, '健康检查应返回 200');
    await runner.assert(res.data?.status === 'ok', '健康检查状态应为 ok');
  });

  // Test 2: Skill 列表
  await runner.runTest('获取 Skill 列表', async () => {
    const res = await request('GET', '/api/skills');
    await runner.assertEquals(res.status, 200, '应返回 200');
    await runner.assert(Array.isArray(res.data), '应返回数组');
    await runner.assert(res.data.length >= 4, '至少有4个内置 skills');
    log(`  发现 ${res.data.length} 个 skills`);
  });

  // Test 3: 工具列表
  await runner.runTest('获取工具列表', async () => {
    const res = await request('GET', '/api/tools');
    await runner.assertEquals(res.status, 200, '应返回 200');
    await runner.assert(Array.isArray(res.data), '应返回数组');
    const execTool = res.data.find(t => t.name === 'exec_command');
    await runner.assert(execTool, '应包含 exec_command 工具');
  });

  // Test 4: 会话 CRUD
  await runner.runTest('会话 CRUD', async () => {
    // 创建会话
    const createRes = await request('POST', '/api/sessions', { title: 'Test Session' });
    await runner.assertEquals(createRes.status, 201, '创建应返回 201');
    const sessionId = createRes.data.id;
    
    // 获取会话
    const getRes = await request('GET', `/api/sessions/${sessionId}`);
    await runner.assertEquals(getRes.status, 200, '获取应返回 200');
    
    // 更新标题
    const updateRes = await request('PUT', `/api/sessions/${sessionId}`, { title: 'Updated Title' });
    await runner.assertEquals(updateRes.status, 200, '更新应返回 200');
    
    log(`  会话 ID: ${sessionId}`);
  });

  // Test 5: Webhook 配置
  await runner.runTest('Webhook 配置', async () => {
    const res = await request('GET', '/api/webhook/config');
    await runner.assertEquals(res.status, 200, '应返回 200');
  });

  // Test 6: LangGraph 配置
  await runner.runTest('LangGraph 配置', async () => {
    const res = await request('GET', '/api/config/langgraph');
    await runner.assertEquals(res.status, 200, '应返回 200');
    await runner.assert(res.data?.graph_mode, '应包含 graph_mode');
  });

  // Test 7: 本地 Skill 文件扫描
  await runner.runTest('本地 Skill 扫描', async () => {
    const res = await request('GET', '/api/skills');
    const localSkills = res.data.filter(s => s.file_path || s.source === 'local');
    log(`  本地 Skills: ${localSkills.length} 个`);
    localSkills.forEach(s => log(`    - ${s.name}`));
  });

  // 汇总
  log('\n========================================');
  log(`测试完成: ${runner.results.passed} 通过, ${runner.results.failed} 失败`);
  log(`日志文件: ${LOG_FILE}`);
  log('========================================');

  return runner.results.failed === 0 ? 0 : 1;
}

// 运行测试
runTests().then(code => {
  process.exit(code);
}).catch(err => {
  log(`测试执行错误: ${err.message}`, 'ERROR');
  process.exit(1);
});
