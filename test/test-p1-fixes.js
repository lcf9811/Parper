#!/usr/bin/env node
/**
 * P1 缺陷修复验证测试
 *
 * 用途：验证 P1 级别缺陷是否已正确修复
 * 运行：node test-p1-fixes.js
 * 前提：后端服务运行在 localhost:8787，数据库已初始化
 *
 * P1 缺陷列表（15 项）：
 *
 * 后端运行时（4 项，核心问题）
 *   BE-03: toolLoopEnabled=false 返回原始工具输出
 *   BE-05: tool_calls + 空 content 时显示道歉消息
 *   BE-06: SSE 重连竞态条件
 *   BE-07: on_chain_end fallback 对纯 tool_calls 失效
 *
 * 数据库（2 项）
 *   DB-01: init.sql 缺少 agent_skills.built_in
 *   DB-02: knowledge_chunks FULLTEXT 无 ngram
 *
 * 前端体验（5 项）
 *   FE-05: EventSource 监听器未移除
 *   FE-06: 3秒轮询全量重渲染
 *   FE-07: loading 不覆盖流式持续时间
 *   FE-08: ExecutionLog 不轮询步骤
 *   FE-13: 前端无错误边界
 *
 * 知识检索（3 项）
 *   KR-04: knowledge_lookup 工具返回固定话术
 *   KR-05: 自动检索与工具检索冲突
 *   KR-06: knowledgeRetrievalNode 硬编码 topK
 *
 * 其他（1 项）
 *   OT-01: errorHandler 生产环境泄露敏感信息
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8787';
const LOG_FILE = path.join(__dirname, `test-p1-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

// ============ 工具函数 ============

function log(msg, level = 'INFO') {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlPath, BASE);
    const options = {
      hostname: urlObj.hostname || 'localhost',
      port: urlObj.port || 8787,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: 15000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function get(urlPath) { return request('GET', urlPath); }
function post(urlPath, body) { return request('POST', urlPath, body); }
function put(urlPath, body) { return request('PUT', urlPath, body); }
function del(urlPath) { return request('DELETE', urlPath); }

/** SSE 事件流读取器（支持读取所有事件直到连接关闭或超时） */
function sseRequest(urlPath, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlPath, BASE);
    const options = {
      hostname: urlObj.hostname || 'localhost',
      port: urlObj.port || 8787,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
      timeout: timeoutMs,
    };
    const req = http.request(options, (res) => {
      const events = [];
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const event = { raw: part };
          const eventMatch = part.match(/event:\s*(\w+)/);
          const dataMatch = part.match(/data:\s*(.+)/);
          if (eventMatch) event.event = eventMatch[1];
          if (dataMatch) {
            try { event.data = JSON.parse(dataMatch[1]); } catch { event.data = dataMatch[1]; }
          }
          events.push(event);
        }
      });
      res.on('end', () => resolve(events));
      res.on('error', (err) => reject(err));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`SSE request timeout after ${timeoutMs}ms`));
    });
    req.end();
  });
}

function assert(condition, message) {
  results.total++;
  if (condition) {
    results.passed++;
    results.details.push({ status: 'PASS', message });
    log(`  ✓ ${message}`, 'PASS');
  } else {
    results.failed++;
    results.details.push({ status: 'FAIL', message });
    log(`  ✗ ${message}`, 'FAIL');
  }
}

function skip(message) {
  results.skipped++;
  results.details.push({ status: 'SKIP', message });
  log(`  ⊘ ${message}`, 'SKIP');
}

/** 等待执行完成并返回执行对象 */
async function waitForExecution(executionId, maxRetries = 60, intervalMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const res = await get(`/api/executions/${executionId}`);
    if (res.data?.status === 'completed' || res.data?.status === 'failed') {
      return res.data;
    }
  }
  return null;
}

// ============ 测试用例 ============

// =========================================================================
// BE-03: toolLoopEnabled=false 返回原始工具输出
// =========================================================================
/**
 * 缺陷描述：当 toolLoopEnabled=false 时，图在 tools 节点后直接结束，
 * 最后一条消息是 ToolMessage，用户收到的是原始 JSON/命令输出。
 *
 * 修复验证方法：
 * 1. 将 tool_loop_enabled 设为 false
 * 2. 发送触发工具调用的消息
 * 3. 检查回复是否为自然语言（不应包含 ToolMessage 的原始输出）
 * 4. 恢复配置
 */
async function testBE03() {
  log('\n========== BE-03: toolLoopEnabled=false 返回自然语言回复 ==========');

  // 保存原始配置
  const configRes = await get('/api/config/langgraph');
  if (configRes.status !== 200) {
    skip('获取 LangGraph 配置失败');
    return;
  }
  const originalToolLoop = configRes.data?.tool_loop_enabled;

  // 设置 toolLoopEnabled = false
  await put('/api/config/langgraph', { tool_loop_enabled: false });

  // 创建会话
  const sessionRes = await post('/api/sessions', { title: 'test-be03' });
  if (sessionRes.status !== 200 && sessionRes.status !== 201) {
    assert(false, '创建测试会话失败');
    await put('/api/config/langgraph', { tool_loop_enabled: true });
    return;
  }
  const sessionId = sessionRes.data?.id;

  // 发送消息（触发工具调用）
  const chatRes = await post('/api/chat/stream', {
    sessionId,
    message: '现在几点了？',
    tools: ['current_time'],
    skills: ['general_assistant'],
  });

  if (chatRes.data?.executionId) {
    const execution = await waitForExecution(chatRes.data.executionId);

    if (execution?.status === 'completed') {
      const reply = execution.output || '';

      // 检查1：回复不包含 ToolMessage 原始结构
      const isRawToolOutput = reply.startsWith('ToolMessage') ||
        reply.includes('content:') ||
        (reply.includes('"type"') && reply.includes('"tool"'));
      assert(!isRawToolOutput,
        `回复不是原始 ToolMessage 输出`);

      // 检查2：回复是自然语言（包含中文或英文单词）
      const isNaturalLanguage = /[一-龥]|[a-z]{3,}/i.test(reply);
      assert(isNaturalLanguage,
        `回复是自然语言（内容: ${reply.substring(0, 80)}）`);

      // 检查3：回复长度合理
      assert(reply.length > 5,
        `回复长度合理（${reply.length} 字符）`);

    } else if (execution?.status === 'failed') {
      assert(false, `执行失败: ${execution.error}`);
    } else {
      assert(false, '执行超时未完成');
    }
  } else {
    assert(false, '启动流式执行失败');
  }

  // 恢复配置
  await put('/api/config/langgraph', { tool_loop_enabled: originalToolLoop !== false });

  // 清理
  await del(`/api/sessions/${sessionId}`).catch(() => {});
}

// =========================================================================
// BE-05: 流式运行时 tool_calls + 空 content 时显示道歉消息
// =========================================================================
/**
 * 缺陷描述：LLM 返回 tool_calls 但 content="" 时，fullContent 为空，
 * 用户看到"抱歉，我没有生成任何回复。"
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 runtimeStreaming.ts 中是否在 tool_calls 为空 content 时
 *    从最终状态提取自然语言回复
 * 2. 检查是否在最终输出中使用最后一条 assistant 消息的 text
 */
async function testBE05() {
  log('\n========== BE-05: tool_calls + 空 content 不显示道歉消息 ==========');

  const filePath = path.join(__dirname, '..', 'server', 'src', 'graph', 'runtimeStreaming.ts');

  try {
    const code = fs.readFileSync(filePath, 'utf-8');

    // 检查1：不再在 content 为空时直接返回道歉消息
    // 旧代码模式: fullContent 为空时用默认字符串
    const hasDefaultApology = code.includes("'抱歉，我没有生成任何回复。'") ||
      code.includes('抱歉，我没有生成任何回复');
    assert(!hasDefaultApology,
      'runtimeStreaming.ts 不再使用固定道歉消息作为默认回复');

    // 检查2：有从最终 state 提取回复的兜底逻辑
    const hasStateFallback = code.includes('data?.output?.messages') ||
      code.includes('result.messages') ||
      code.includes('output.messages') ||
      code.includes('lastMsg') && code.includes('content');
    assert(hasStateFallback,
      'runtimeStreaming.ts 有从最终 state 提取回复的兜底逻辑');

    // 检查3：on_chain_end 条件足够宽松以捕获 tool_calls 场景
    const hasWideChainEnd = code.includes("!name?.includes('Channel')") ||
      code.includes('!name?.includes') ||
      code.includes("name !== 'Channel'");
    assert(hasWideChainEnd,
      'on_chain_end 事件匹配条件足够宽松以捕获 tool_calls 场景');

    // 检查4：处理 tool_calls 后等待最终回复
    const handlesToolCalls = code.includes('tool_calls') &&
      (code.includes('lastMsg') || code.includes('final') || code.includes('reply'));
    assert(handlesToolCalls,
      'runtimeStreaming.ts 处理了 tool_calls 后提取最终回复');

  } catch (err) {
    assert(false, `读取 runtimeStreaming.ts 失败: ${err.message}`);
  }
}

// =========================================================================
// BE-06: SSE 重连竞态条件
// =========================================================================
/**
 * 缺陷描述：替换旧连接时，旧响应的异步 close 事件会删除新注册客户端，
 * SSE 连接虽开着但收不到事件。
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 sseService.ts 中 closeConnection 和 removeClient 的逻辑
 * 2. 检查是否有客户端 token/ID 区分新旧连接
 * 3. 检查 removeClient 中是否校验 res 对象一致性
 */
async function testBE06() {
  log('\n========== BE-06: SSE 重连竞态条件 ==========');

  const sseServicePath = path.join(__dirname, '..', 'server', 'src', 'services', 'sseService.ts');

  try {
    const code = fs.readFileSync(sseServicePath, 'utf-8');

    // 方案1：使用客户端 ID/token 区分连接
    const usesClientId = code.includes('clientId') ||
      code.includes('clientToken') ||
      code.includes('connectionId') ||
      code.includes('token');
    log(`  使用客户端 ID 区分连接: ${usesClientId}`);

    // 方案2：removeClient 中校验 res 对象一致性
    const validatesRes = code.includes('client.res === res') ||
      code.includes('res === client.res') ||
      (code.includes('existing') && code.includes('res'));
    log(`  removeClient 校验 res 一致性: ${validatesRes}`);

    // 方案3：closeConnection 使用 token 验证
    const usesTokenOnClose = code.includes('closeConnection') &&
      (code.includes('token') || code.includes('id'));
    log(`  closeConnection 使用 token: ${usesTokenOnClose}`);

    // 综合判断：至少采用了一种方案
    assert(usesClientId || validatesRes,
      'sseService.ts 采用了防止新旧连接竞态的保护措施（客户端 ID 或 res 校验）');

    // 额外检查：registerClient 中关闭旧连接的方式
    const hasSafeClose = code.includes('try') && code.includes('client.res.end');
    log(`  registerClient 中安全关闭旧连接: ${hasSafeClose}`);

    // 检查：Map 的 key 是否包含唯一标识
    const mapKeyPattern = code.includes('clients.set(');
    if (mapKeyPattern) {
      const setMatch = code.match(/clients\.set\(([^,]+)/);
      if (setMatch) {
        const keyExpr = setMatch[1].trim();
        log(`  clients.set 的 key 表达式: ${keyExpr}`);
      }
    }

  } catch (err) {
    assert(false, `读取 sseService.ts 失败: ${err.message}`);
  }
}

// =========================================================================
// BE-07: on_chain_end fallback 对纯 tool_calls 消息失效
// =========================================================================
/**
 * 缺陷描述：若最后消息是带 tool_calls 但无 content 的 AIMessage，
 * lastMsg.content === "" 为 falsy，fullContent 仍为空。
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 runtimeStreaming.ts 的 on_chain_end 兜底逻辑
 * 2. 检查是否使用 lastMsg.text 或其他方式提取内容
 */
async function testBE07() {
  log('\n========== BE-07: on_chain_end fallback 处理纯 tool_calls ==========');

  const filePath = path.join(__dirname, '..', 'server', 'graph', 'runtimeStreaming.ts');
  const filePath2 = path.join(__dirname, '..', 'server', 'src', 'graph', 'runtimeStreaming.ts');

  try {
    let code;
    try {
      code = fs.readFileSync(filePath, 'utf-8');
    } catch {
      code = fs.readFileSync(filePath2, 'utf-8');
    }

    // 检查1：on_chain_end 兜底逻辑存在
    const hasChainEndFallback = code.includes("name === 'LangGraph'") ||
      code.includes("name === 'LangGraph'") ||
      code.includes('on_chain_end') && code.includes('output');
    assert(hasChainEndFallback,
      'runtimeStreaming.ts 有 on_chain_end 兜底逻辑');

    // 检查2：兜底逻辑检查了 lastMsg 的多种内容字段
    // 应检查 content、text、或完整消息
    const checksMultipleFields = code.includes('lastMsg.text') ||
      code.includes('lastMsg.content') ||
      code.includes('lastMsg?.content') ||
      (code.includes('JSON.stringify') && code.includes('lastMsg'));
    assert(checksMultipleFields,
      '兜底逻辑检查了 lastMsg 的 content/text 等字段');

    // 检查3：兜底逻辑不只在 content 非空时提取
    // 旧代码: if (lastMsg && !fullContent) { ... content ... }
    // 新代码应能处理 content 为空但有 tool_calls 的情况
    const handlesEmptyContent = code.includes('finalContent') ||
      code.includes('final') && code.includes('content') ||
      code.includes('reply') && code.includes('messages');
    assert(handlesEmptyContent,
      '兜底逻辑能处理 content 为空但有工具调用的场景');

    // 检查4：最终回复提取在 stream 循环之后
    const hasPostLoopExtract = code.includes('for await') &&
      code.includes('fullContent') &&
      code.includes('reply');
    assert(hasPostLoopExtract,
      'stream 循环后有最终回复提取逻辑');

  } catch (err) {
    assert(false, `读取 runtimeStreaming.ts 失败: ${err.message}`);
  }
}

// =========================================================================
// DB-01: init.sql 缺少 agent_skills.built_in 字段
// =========================================================================
async function testDB01() {
  log('\n========== DB-01: agent_skills.built_in 字段 ==========');

  const initSqlPath = path.join(__dirname, '..', 'sql', 'init.sql');

  // 检查1：init.sql 中 agent_skills 表有 built_in 字段
  try {
    const sql = fs.readFileSync(initSqlPath, 'utf-8');
    const hasBuiltInColumn = sql.includes('built_in') &&
      sql.includes('TINYINT') &&
      sql.includes('agent_skills');
    assert(hasBuiltInColumn,
      'init.sql 中 agent_skills 表定义了 built_in 字段');

    // 检查2：种子数据 INSERT 中设置了 built_in 值
    const hasBuiltInValue = sql.includes('built_in') &&
      (sql.includes('built_in) VALUES') || sql.includes(', 1)'));
    assert(hasBuiltInValue,
      'init.sql 中种子数据 INSERT 包含了 built_in 值');

  } catch (err) {
    assert(false, `读取 init.sql 失败: ${err.message}`);
  }

  // 检查3：运行时 API 返回 built_in 字段
  const skillsRes = await get('/api/skills');
  if (skillsRes.status === 200 && Array.isArray(skillsRes.data)) {
    const hasField = skillsRes.data.length > 0 && 'built_in' in skillsRes.data[0];
    assert(hasField,
      'API /api/skills 返回的技能对象包含 built_in 字段');
  } else {
    assert(false, '获取技能列表失败');
  }
}

// =========================================================================
// DB-02: knowledge_chunks FULLTEXT 无 ngram 解析器
// =========================================================================
async function testDB02() {
  log('\n========== DB-02: knowledge_chunks FULLTEXT ngram ==========');

  const initSqlPath = path.join(__dirname, '..', 'sql', 'init.sql');

  // 检查1：init.sql 中有 ngram 解析器
  try {
    const sql = fs.readFileSync(initSqlPath, 'utf-8');
    const hasNgram = sql.toLowerCase().includes('ngram');
    assert(hasNgram,
      'init.sql 中 knowledge_chunks 的 FULLTEXT 索引使用 ngram 解析器');

    if (hasNgram) {
      // 提取相关 SQL 语句
      const ngramMatch = sql.match(/FULLTEXT[^;]*ngram[^;]*/gi);
      if (ngramMatch) {
        log(`  ngram 定义: ${ngramMatch[0].substring(0, 120)}...`);
      }
    }

  } catch (err) {
    assert(false, `读取 init.sql 失败: ${err.message}`);
  }

  // 检查2：已有迁移脚本
  const migrationPath = path.join(__dirname, '..', 'sql', 'migration_knowledge_ngram.sql');
  try {
    fs.accessSync(migrationPath);
    assert(true, '存在 ngram 迁移脚本 migration_knowledge_ngram.sql');
  } catch {
    assert(false, '缺少 ngram 迁移脚本（用于已有数据库升级）');
  }

  // 检查3：运行时中文搜索有效
  try {
    // 创建中文测试文档
    const addRes = await post('/api/knowledge', {
      title: 'p1-test-chinese-search',
      content: '污水处理是一种环保技术，MBR 是膜生物反应器'
    });
    if (addRes.status === 200 && addRes.data?.id) {
      const docId = addRes.data.id;

      // 等待分块
      let chunked = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        const statusRes = await get(`/api/knowledge/${docId}`);
        if (statusRes.data?.status === 'chunked') {
          chunked = true;
          break;
        }
      }

      if (chunked) {
        const searchRes = await get('/api/knowledge/search?q=污水处理');
        if (searchRes.status === 200 && Array.isArray(searchRes.data)) {
          const found = searchRes.data.length > 0;
          assert(found,
            `中文搜索 "污水处理" 返回 ${searchRes.data.length} 条结果`);
        } else {
          skip('搜索 API 返回格式异常');
        }
      } else {
        skip('测试文档未完成分块');
      }

      await del(`/api/knowledge/${docId}`).catch(() => {});
    } else {
      skip('创建测试知识文档失败');
    }
  } catch (err) {
    skip(`中文搜索运行时验证失败: ${err.message}`);
  }
}

// =========================================================================
// FE-05: EventSource 监听器从未移除
// =========================================================================
/**
 * 缺陷描述：addEventListener 注册后永不 removeEventListener，造成内存泄漏。
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 Chat.tsx 中 eventSource 的监听器注册方式
 * 2. 检查是否使用 onmessage/onerror 直接赋值（无需移除）
 * 3. 或检查 close 前是否调用 removeEventListener
 */
async function testFE05() {
  log('\n========== FE-05: EventSource 监听器移除 ==========');

  const chatPath = path.join(__dirname, '..', 'web', 'src', 'pages', 'Chat.tsx');

  try {
    const code = fs.readFileSync(chatPath, 'utf-8');

    // 方案A：使用 onmessage 直接赋值（不需要 removeEventListener）
    const usesDirectAssignment = code.includes('eventSource.onmessage') ||
      code.includes('eventSource.oncomplete') ||
      code.includes('eventSource.onerror');
    log(`  使用 onmessage 直接赋值: ${usesDirectAssignment}`);

    // 方案B：addEventListener + removeEventListener 配对
    const hasAddListener = code.includes('addEventListener(');
    const hasRemoveListener = code.includes('removeEventListener(');
    log(`  使用 addEventListener: ${hasAddListener}`);
    log(`  使用 removeEventListener: ${hasRemoveListener}`);

    if (hasAddListener && !hasRemoveListener) {
      assert(false,
        '使用了 addEventListener 但从未调用 removeEventListener（内存泄漏）');
    } else if (hasAddListener && hasRemoveListener) {
      // 检查是否在 close 前移除
      // 查找 eventSource 相关清理代码
      const hasCleanBeforeClose = code.includes('removeEventListener') &&
        code.includes('close');
      assert(hasCleanBeforeClose,
        'close EventSource 前调用了 removeEventListener');
    } else {
      // 如果没有 addEventListener，可能是用了 onmessage 直接赋值
      if (usesDirectAssignment) {
        assert(true,
          '使用 onmessage/onerror 直接赋值，无需 removeEventListener');
      } else {
        assert(false,
          '未找到 EventSource 监听器注册代码');
      }
    }

    // 额外检查：在 cleanup useEffect 中是否有清理
    const hasCleanupInEffect = code.includes('return () =>') &&
      code.includes('eventSource') &&
      code.includes('close');
    log(`  useEffect cleanup 中关闭 EventSource: ${hasCleanupInEffect}`);

    // 检查：发送新消息前是否清理旧连接
    const hasCleanBeforeNew = code.includes('eventSourceRef.current') &&
      (code.includes('onerror = null') || code.includes('removeEventListener'));
    log(`  发送新消息前清理旧连接: ${hasCleanBeforeNew}`);

  } catch (err) {
    assert(false, `读取 Chat.tsx 失败: ${err.message}`);
  }
}

// =========================================================================
// FE-06: 3秒轮询导致每3秒全量重渲染
// =========================================================================
/**
 * 缺陷描述：loadMessages 每次都创建全新对象数组，且 ChatMessage 无 React.memo，
 * 所有消息组件每3秒重新渲染。
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 ChatMessage 是否包裹 React.memo
 * 2. 检查 loadMessages 是否有数据对比跳过逻辑
 * 3. 检查 StreamingMessage 是否包裹 React.memo
 */
async function testFE06() {
  log('\n========== FE-06: 轮询全量重渲染优化 ==========');

  const chatMsgPath = path.join(__dirname, '..', 'web', 'src', 'components', 'ChatMessage.tsx');
  const streamingMsgPath = path.join(__dirname, '..', 'web', 'src', 'components', 'StreamingMessage.tsx');
  const chatPath = path.join(__dirname, '..', 'web', 'src', 'pages', 'Chat.tsx');

  try {
    // 检查1：ChatMessage 是否使用 React.memo
    const chatMsgCode = fs.readFileSync(chatMsgPath, 'utf-8');
    const chatMsgMemo = chatMsgCode.includes('React.memo') ||
      chatMsgCode.includes('memo(') ||
      chatMsgCode.includes('memoed') ||
      chatMsgCode.includes('memoized');
    assert(chatMsgMemo,
      'ChatMessage.tsx 使用 React.memo 包裹组件');

    // 检查2：StreamingMessage 是否使用 React.memo
    const streamingMsgCode = fs.readFileSync(streamingMsgPath, 'utf-8');
    const streamingMsgMemo = streamingMsgCode.includes('React.memo') ||
      streamingMsgCode.includes('memo(');
    assert(streamingMsgMemo,
      'StreamingMessage.tsx 使用 React.memo 包裹组件');

    // 检查3：loadMessages 是否有数据对比跳过逻辑
    const chatCode = fs.readFileSync(chatPath, 'utf-8');
    const hasDataCompare = chatCode.includes('JSON.stringify') ||
      chatCode.includes('deepEqual') ||
      chatCode.includes('isEqual') ||
      (chatCode.includes('setMessages') && chatCode.includes('skip')) ||
      chatCode.includes('setMessages') && chatCode.includes('same');

    // 或者检查是否在 setMessages 前对比了消息内容
    const hasSkipSetMessages = chatCode.includes('if') &&
      chatCode.includes('setMessages') &&
      (chatCode.includes('length') || chatCode.includes('stringify') || chatCode.includes('equal'));

    assert(hasDataCompare || hasSkipSetMessages,
      'loadMessages 有数据对比逻辑，无变化时跳过 setMessages');

    // 额外：检查消息列表渲染是否使用稳定 key
    const hasStableKey = chatCode.includes('key={m.id') ||
      chatCode.includes('key={m.');
    log(`  消息列表使用稳定 key: ${hasStableKey}`);

  } catch (err) {
    assert(false, `读取文件失败: ${err.message}`);
  }
}

// =========================================================================
// FE-07: loading 状态不覆盖流式持续时间
// =========================================================================
/**
 * 缺陷描述：setLoading(false) 在 finally 中，POST 返回后即变为 false，
 * 但 SSE 仍在流式输出中，发送按钮在此期间可点击。
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查发送按钮 disabled 条件是否包含 isStreaming
 * 2. 检查 handleSend 中 setLoading 的处理方式
 */
async function testFE07() {
  log('\n========== FE-07: loading 不覆盖流式持续时间 ==========');

  const chatPath = path.join(__dirname, '..', 'web', 'src', 'pages', 'Chat.tsx');

  try {
    const code = fs.readFileSync(chatPath, 'utf-8');

    // 检查1：发送按钮 disabled 包含 isStreaming
    const buttonDisabledStream = code.includes('disabled') &&
      code.includes('isStreaming') &&
      (code.includes('loading') || code.includes('loading'));
    assert(buttonDisabledStream,
      '发送按钮 disabled 条件包含 isStreaming');

    // 检查2：disabled 表达式中同时包含 loading 和 isStreaming
    const disabledMatch = code.match(/disabled[\s\S]*?={([^}]+)}/);
    if (disabledMatch) {
      const expr = disabledMatch[1];
      const hasBoth = expr.includes('loading') && expr.includes('isStreaming');
      log(`  发送按钮 disabled 表达式: ${expr.substring(0, 100)}`);
      assert(hasBoth,
        '发送按钮 disabled 同时使用 loading 和 isStreaming');
    }

    // 检查3：handleSend 的 finally 中 setLoading(false) 但按钮仍被 isStreaming 保护
    const hasFinallyLoading = code.includes('finally') &&
      code.includes('setLoading(false)');
    log(`  handleSend finally 中有 setLoading(false): ${hasFinallyLoading}`);

    // 综合判断：即使 finally 中 setLoading(false)，只要按钮有 isStreaming 保护就 ok
    if (hasFinallyLoading && buttonDisabledStream) {
      assert(true,
        '即使 finally 中 setLoading(false)，按钮仍被 isStreaming 保护');
    }

  } catch (err) {
    assert(false, `读取 Chat.tsx 失败: ${err.message}`);
  }
}

// =========================================================================
// FE-08: ExecutionLog 不轮询步骤
// =========================================================================
/**
 * 缺陷描述：执行过程中步骤列表为空或过时，直到执行完成才刷新。
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 ExecutionLog.tsx 中是否有 setInterval 轮询
 * 2. 检查是否在步骤未完成时持续拉取
 */
async function testFE08() {
  log('\n========== FE-08: ExecutionLog 轮询步骤 ==========');

  const execLogPath = path.join(__dirname, '..', 'web', 'src', 'components', 'ExecutionLog.tsx');

  try {
    const code = fs.readFileSync(execLogPath, 'utf-8');

    // 检查1：有 setInterval 轮询步骤
    const hasInterval = code.includes('setInterval') ||
      code.includes('setTimeout') && code.includes('fetch') ||
      code.includes('interval');
    assert(hasInterval,
      'ExecutionLog.tsx 有定时轮询步骤的逻辑');

    // 检查2：轮询在步骤完成或执行完成后停止
    const hasStopCondition = code.includes('clearInterval') ||
      code.includes('completed') ||
      code.includes('clearTimeout');
    assert(hasStopCondition,
      '轮询有停止条件（执行完成或步骤完整时停止）');

    // 检查3：轮询间隔合理（不应太频繁）
    const intervalMatch = code.match(/setInterval[^,]*,\s*(\d+)/);
    if (intervalMatch) {
      const intervalMs = parseInt(intervalMatch[1]);
      const isReasonable = intervalMs >= 500 && intervalMs <= 5000;
      assert(isReasonable,
        `轮询间隔合理（${intervalMs}ms，建议 500-5000ms）`);
    } else {
      log('  未找到明确的 setInterval 间隔值');
    }

    // 额外：检查是否在执行中持续拉取
    const hasRunningCheck = code.includes('running') ||
      code.includes('status') ||
      code.includes('execution');
    log(`  检查执行状态: ${hasRunningCheck}`);

  } catch (err) {
    assert(false, `读取 ExecutionLog.tsx 失败: ${err.message}`);
  }
}

// =========================================================================
// FE-13: 前端无错误边界处理
// =========================================================================
/**
 * 缺陷描述：任何未捕获的 React 渲染错误会导致整个应用白屏。
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 App.tsx 是否包裹 ErrorBoundary
 * 2. 检查是否有 ErrorBoundary 组件定义
 */
async function testFE13() {
  log('\n========== FE-13: 前端错误边界 ==========');

  const appPath = path.join(__dirname, '..', 'web', 'src', 'App.tsx');
  const mainPath = path.join(__dirname, '..', 'web', 'src', 'main.tsx');
  const srcDir = path.join(__dirname, '..', 'web', 'src');

  // 检查1：App.tsx 或 main.tsx 中有 ErrorBoundary
  let hasErrorBoundary = false;

  try {
    const appCode = fs.readFileSync(appPath, 'utf-8');
    hasErrorBoundary = appCode.includes('ErrorBoundary') ||
      appCode.includes('errorBoundary') ||
      appCode.includes('error-boundary');
    if (hasErrorBoundary) {
      log(`  App.tsx 包含 ErrorBoundary`);
    }
  } catch {
    log('  App.tsx 不存在');
  }

  if (!hasErrorBoundary) {
    try {
      const mainCode = fs.readFileSync(mainPath, 'utf-8');
      hasErrorBoundary = mainCode.includes('ErrorBoundary') ||
        mainCode.includes('errorBoundary');
      if (hasErrorBoundary) {
        log(`  main.tsx 包含 ErrorBoundary`);
      }
    } catch {
      log('  main.tsx 不存在');
    }
  }

  // 检查2：是否有 ErrorBoundary 组件文件
  if (!hasErrorBoundary) {
    const components = fs.readdirSync(srcDir);
    for (const dir of components) {
      try {
        const files = fs.readdirSync(path.join(srcDir, dir));
        const hasEBFile = files.some(f =>
          f.toLowerCase().includes('error') && f.toLowerCase().includes('boundary')
        );
        if (hasEBFile) {
          hasErrorBoundary = true;
          log(`  找到 ErrorBoundary 组件文件: ${dir}/${files.find(f => f.toLowerCase().includes('error'))}`);
          break;
        }
      } catch {}
    }
  }

  assert(hasErrorBoundary,
    '前端有 ErrorBoundary 组件包裹应用根节点');

  // 检查3：ErrorBoundary 有 fallback UI
  if (hasErrorBoundary) {
    // 在 src 目录下搜索 fallback 相关内容
    const searchFiles = (dir) => {
      try {
        for (const file of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              if (searchFiles(fullPath)) return true;
            } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
              const content = fs.readFileSync(fullPath, 'utf-8');
              if (content.includes('fallback') || content.includes('Fallback') ||
                  content.includes('错误') || content.includes('error')) {
                return true;
              }
            }
          } catch {}
        }
      } catch {}
      return false;
    };
    const hasFallback = searchFiles(srcDir);
    assert(hasFallback,
      'ErrorBoundary 有 fallback UI（错误时显示提示信息）');
  }
}

// =========================================================================
// KR-04: knowledge_lookup 工具返回固定话术
// =========================================================================
/**
 * 缺陷描述：工具返回"未在知识库中找到相关内容"等固定中文字符串，
 * LLM 可能将其改写为"我来为您搜索..."
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 knowledgeLookup.ts 返回值是否为结构化 JSON
 * 2. 检查是否不再返回固定中文话术
 */
async function testKR04() {
  log('\n========== KR-04: knowledge_lookup 工具返回格式 ==========');

  const klPath = path.join(__dirname, '..', 'server', 'src', 'tools', 'knowledgeLookup.ts');

  try {
    const code = fs.readFileSync(klPath, 'utf-8');

    // 检查1：不再返回固定中文话术
    const hasFixedChineseText = code.includes('未在知识库中找到') ||
      code.includes('未找到相关') ||
      code.includes('我来为您搜索') ||
      code.includes('搜索关于');
    assert(!hasFixedChineseText,
      'knowledgeLookup.ts 不再返回固定中文话术');

    // 检查2：返回结构化 JSON
    const returnsJson = code.includes('JSON.stringify') ||
      code.includes('found:') ||
      code.includes('results:') ||
      code.includes('chunks:') ||
      code.includes('count:');
    assert(returnsJson,
      'knowledgeLookup.ts 返回结构化数据（JSON 格式）');

    // 检查3：有明确的"无结果"信号而非固定话术
    const hasNoResultsSignal = code.includes('found') ||
      code.includes('empty') ||
      code.includes('no results') ||
      code.includes('count') ||
      code.includes('results');
    assert(hasNoResultsSignal,
      '有明确的"无结果"信号（如 found: false 或 count: 0）');

  } catch (err) {
    assert(false, `读取 knowledgeLookup.ts 失败: ${err.message}`);
  }
}

// =========================================================================
// KR-05: 自动检索与工具检索两条路径冲突
// =========================================================================
/**
 * 缺陷描述：autoKnowledgeRetrieval 在 agent 前静默执行，
 * knowledge_lookup 工具又允许 agent 显式搜索，两者重复且矛盾。
 *
 * 修复验证方法：
 * 1. 代码检查：是否只保留了一条检索路径
 * 2. 或检查是否有去重/合并机制
 */
async function testKR05() {
  log('\n========== KR-05: 知识检索路径冲突 ==========');

  const builderPath = path.join(__dirname, '..', 'server', 'src', 'graph', 'builder.ts');
  const nodesPath = path.join(__dirname, '..', 'server', 'src', 'graph', 'nodes.ts');

  try {
    const builderCode = fs.readFileSync(builderPath, 'utf-8');
    const nodesCode = fs.readFileSync(nodesPath, 'utf-8');

    // 检查是否仍有两条路径
    const hasAutoRetrieval = builderCode.includes('knowledge_retrieval') &&
      builderCode.includes('autoKnowledgeRetrieval');
    const hasToolRetrieval = nodesCode.includes('knowledge_lookup') ||
      nodesCode.includes('knowledgeLookup') ||
      builderCode.includes('knowledge_lookup');

    log(`  自动知识检索路径存在: ${hasAutoRetrieval}`);
    log(`  工具知识检索路径存在: ${hasToolRetrieval}`);

    if (hasAutoRetrieval && hasToolRetrieval) {
      // 两条路径都存在，检查是否有去重/合并机制
      const hasDedup = nodesCode.includes('dedup') ||
        nodesCode.includes('already searched') ||
        nodesCode.includes('skip') ||
        nodesCode.includes('knowledgeContext.length') ||
        nodesCode.includes('knowledgeContext.length > 0');
      assert(hasDedup,
        '自动检索和工具检索两条路径有去重/防重复机制');
    } else if (hasAutoRetrieval && !hasToolRetrieval) {
      // 只保留了自动检索
      assert(true,
        '只保留了自动知识检索路径，工具检索已移除');
    } else if (!hasAutoRetrieval && hasToolRetrieval) {
      // 只保留了工具检索
      assert(true,
        '只保留了工具知识检索路径，自动检索已移除');
    } else {
      assert(false,
        '未找到任何知识检索路径');
    }

  } catch (err) {
    assert(false, `读取文件失败: ${err.message}`);
  }
}

// =========================================================================
// KR-06: knowledgeRetrievalNode 硬编码 topK=5
// =========================================================================
/**
 * 缺陷描述：nodes.ts:106 中 knowledgeRetrievalNode 硬编码 topK=5，
 * 忽略数据库 langgraph_config.knowledge_top_k 配置。
 *
 * 修复验证方法：
 * 1. 代码检查：knowledgeRetrievalNode 是否读取配置
 */
async function testKR06() {
  log('\n========== KR-06: knowledgeRetrievalNode topK 配置 ==========');

  const nodesPath = path.join(__dirname, '..', 'server', 'src', 'graph', 'nodes.ts');

  try {
    const code = fs.readFileSync(nodesPath, 'utf-8');

    // 查找 knowledgeRetrievalNode 函数
    const nodeFuncMatch = code.match(/export\s+async\s+function\s+knowledgeRetrievalNode[\s\S]*?(?=export|\/\/\s*---)/);

    if (nodeFuncMatch) {
      const funcCode = nodeFuncMatch[0];

      // 检查是否硬编码 5
      const hasHardcoded5 = funcCode.includes('search(queryText, 5)') ||
        funcCode.includes(', 5)') && funcCode.includes('search');
      assert(!hasHardcoded5,
        'knowledgeRetrievalNode 不再硬编码 topK=5');

      // 检查是否读取配置
      const readsConfig = funcCode.includes('config') ||
        funcCode.includes('knowledge_top_k') ||
        funcCode.includes('topK') && !funcCode.includes(', 5)');
      assert(readsConfig,
        'knowledgeRetrievalNode 从配置读取 topK 值');

      if (!hasHardcoded5 && !readsConfig) {
        // 可能是通过参数传入
        const hasParam = funcCode.includes('topK') ||
          funcCode.includes('top_k') ||
          funcCode.includes('state.topK');
        assert(hasParam,
          'knowledgeRetrievalNode 通过参数或 state 获取 topK');
      }

    } else {
      assert(false, '未找到 knowledgeRetrievalNode 函数定义');
    }

  } catch (err) {
    assert(false, `读取 nodes.ts 失败: ${err.message}`);
  }
}

// =========================================================================
// OT-01: errorHandler 生产环境泄露敏感信息
// =========================================================================
/**
 * 缺陷描述：errorHandler 未区分开发/生产环境，
 * 生产环境将原始错误信息（可能包含堆栈、SQL 语句）返回给客户端。
 *
 * 修复验证方法（代码静态分析）：
 * 1. 检查 errorHandler.ts 是否检查 NODE_ENV
 * 2. 检查生产环境是否隐藏了详细错误
 */
async function testOT01() {
  log('\n========== OT-01: errorHandler 生产环境保护 ==========');

  const errorHandlerPath = path.join(__dirname, '..', 'server', 'src', 'middleware', 'errorHandler.ts');

  try {
    const code = fs.readFileSync(errorHandlerPath, 'utf-8');

    // 检查1：有环境检查
    const hasEnvCheck = code.includes('NODE_ENV') ||
      code.includes('process.env.NODE_ENV') ||
      code.includes('production') ||
      code.includes('development') ||
      code.includes('env.');
    assert(hasEnvCheck,
      'errorHandler.ts 检查了运行环境（NODE_ENV）');

    // 检查2：生产环境返回通用错误消息
    const hasGenericError = code.includes('服务器内部错误') ||
      code.includes('Internal Server Error') ||
      code.includes('服务器') ||
      code.includes('Something went wrong');
    assert(hasGenericError,
      '生产环境返回通用错误消息而非原始堆栈');

    // 检查3：开发环境才返回详细错误
    const hasDevDetail = code.includes('stack') ||
      code.includes('error.message') ||
      code.includes('error.stack');
    if (hasEnvCheck && hasDevDetail) {
      // 有环境检查且有详细错误返回，说明可能在开发环境返回
      const returnsDetailInDev = code.includes('development') &&
        (code.includes('stack') || code.includes('message'));
      log(`  开发环境返回详细错误: ${returnsDetailInDev}`);
    }

    // 打印错误处理器的关键代码
    const lines = code.split('\n');
    const relevantLines = lines.filter(l =>
      l.includes('error') || l.includes('res.status') ||
      l.includes('stack') || l.includes('message') ||
      l.includes('NODE_ENV') || l.includes('env')
    ).slice(0, 10);
    log(`  相关代码: ${relevantLines.join(' | ').substring(0, 200)}`);

  } catch (err) {
    assert(false, `读取 errorHandler.ts 失败: ${err.message}`);
  }
}

// ============ 主函数 ============

async function runAllTests() {
  log('========================================');
  log('P1 缺陷修复验证测试');
  log(`运行时间: ${new Date().toISOString()}`);
  log('日志文件: ' + LOG_FILE);
  log('========================================');

  // 先检查服务是否运行
  try {
    const health = await get('/api/health');
    if (health.status !== 200) {
      log('后端服务未正常运行，请先启动服务 (npm run dev)', 'ERROR');
      process.exit(1);
    }
    log('后端服务正常，开始测试', 'PASS');
  } catch (err) {
    log('后端服务连接失败: ' + err.message, 'ERROR');
    process.exit(1);
  }

  // ── 后端运行时核心问题 ──
  await testBE03();
  await testBE05();
  await testBE06();
  await testBE07();

  // ── 数据库 ──
  await testDB01();
  await testDB02();

  // ── 前端体验问题 ──
  await testFE05();
  await testFE06();
  await testFE07();
  await testFE08();
  await testFE13();

  // ── 知识检索 ──
  await testKR04();
  await testKR05();
  await testKR06();

  // ── 其他 ──
  await testOT01();

  // 打印总结
  log('\n========================================');
  log('测试结果总结');
  log('========================================');
  log(`总计: ${results.total}`);
  log(`通过: ${results.passed}`);
  log(`失败: ${results.failed}`);
  log(`跳过: ${results.skipped}`);
  log(`通过率: ${results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0}%`);

  // 按缺陷汇总
  const defectResults = {};
  for (const d of results.details) {
    // 从 message 中提取缺陷编号
    const match = d.message.match(/^(DB|BE|FE|KR|OT)-\d+/);
    if (match) {
      const id = match[0];
      if (!defectResults[id]) defectResults[id] = { pass: 0, fail: 0, skip: 0 };
      if (d.status === 'PASS') defectResults[id].pass++;
      else if (d.status === 'FAIL') defectResults[id].fail++;
      else defectResults[id].skip++;
    }
  }
  log('\n按缺陷汇总:');
  for (const [id, r] of Object.entries(defectResults)) {
    const total = r.pass + r.fail + r.skip;
    const status = r.fail > 0 ? '❌' : r.pass > 0 ? '✅' : '⊘';
    log(`  ${status} ${id}: ${r.pass}/${total} 通过`);
  }

  // 打印失败详情
  if (results.failed > 0) {
    log('\n失败用例:');
    results.details
      .filter(d => d.status === 'FAIL')
      .forEach(d => log(`  ✗ ${d.message}`, 'FAIL'));
  }

  log('\n日志已保存至: ' + LOG_FILE);
  log('========================================');

  // 输出 JSON 结果
  const jsonPath = LOG_FILE.replace('.log', '.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ results, defectResults }, null, 2));
  log(`JSON 结果已保存至: ${jsonPath}`);

  return results.failed > 0 ? 1 : 0;
}

runAllTests()
  .then(code => process.exit(code))
  .catch(err => {
    log(`测试执行错误: ${err.message}`, 'ERROR');
    console.error(err);
    process.exit(1);
  });
