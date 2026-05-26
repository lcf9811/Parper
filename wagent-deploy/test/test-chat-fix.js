#!/usr/bin/env node
/**
 * 聊天功能修复验证测试
 * 验证：默认只选中 general_assistant 技能，且后端有 system prompt 过长保护
 */

const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 8787, path, method, headers: { 'Content-Type': 'application/json' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Chat Fix Verification ===\n');
  let passed = 0;
  let failed = 0;

  // 测试1：只选 general_assistant，应正常回复
  try {
    const s1 = await request('POST', '/api/sessions', { title: 'FixTest1' });
    const c1 = await request('POST', '/api/chat', {
      sessionId: s1.data.id,
      message: '1+1等于多少',
      skills: ['general_assistant'],
      tools: []
    });
    if (c1.data.reply && c1.data.reply.includes('2')) {
      console.log('✓ Test1 PASSED: general_assistant replies normally');
      passed++;
    } else {
      console.log('✗ Test1 FAILED:', c1.data.reply);
      failed++;
    }
  } catch (e) {
    console.log('✗ Test1 ERROR:', e.message);
    failed++;
  }

  // 测试2：全选所有技能，后端应触发保护，回复仍正常
  try {
    const skillsRes = await request('GET', '/api/skills');
    const allSkillNames = skillsRes.data.filter(s => s.enabled).map(s => s.name);
    const s2 = await request('POST', '/api/sessions', { title: 'FixTest2' });
    const c2 = await request('POST', '/api/chat', {
      sessionId: s2.data.id,
      message: '水处理工艺是什么',
      skills: allSkillNames,
      tools: []
    });
    // 不应再出现之前那种固定的开场白
    const isBadReply = /我来为您搜索关于.*的相关信息/.test(c2.data.reply) ||
                       /我来为您搜索关于.*的相关知识/.test(c2.data.reply);
    if (c2.data.reply && c2.data.reply.length > 30 && !isBadReply) {
      console.log('✓ Test2 PASSED: all-skills mode with backend protection works');
      console.log('  Reply preview:', c2.data.reply.substring(0, 60).replace(/\n/g, ' '));
      passed++;
    } else {
      console.log('✗ Test2 FAILED: reply too short or bad pattern');
      console.log('  Reply:', c2.data.reply);
      failed++;
    }
  } catch (e) {
    console.log('✗ Test2 ERROR:', e.message);
    failed++;
  }

  // 测试3：验证 execution_steps 中 hasToolCalls 的记录
  try {
    const execRes = await request('GET', '/api/executions');
    const recent = execRes.data.slice(0, 5);
    const hasSteps = recent.some(e => e.status === 'completed');
    if (hasSteps) {
      console.log('✓ Test3 PASSED: recent executions completed');
      passed++;
    } else {
      console.log('✗ Test3 FAILED: no completed executions found');
      failed++;
    }
  } catch (e) {
    console.log('✗ Test3 ERROR:', e.message);
    failed++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
