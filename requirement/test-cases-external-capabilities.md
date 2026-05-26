# Skill 外部能力调用 — 测试用例

## 1. capabilityRegistry 能力注册表

### TC-REG-01：启动时扫描并注册技能声明的 capabilities

| 项目 | 内容 |
|------|------|
| 前置条件 | `skills/` 目录下存在包含 `capabilities` 的 SKILL.md |
| 测试步骤 | 调用 `capabilityRegistry.initialize()` |
| 预期结果 | 所有技能的 capabilities 被解析并注册到内存注册表中 |
| 优先级 | P0 |

### TC-REG-02：查询所有已注册的能力

| 项目 | 内容 |
|------|------|
| 前置条件 | 注册表已初始化 |
| 测试步骤 | 调用 `capabilityRegistry.getAllCapabilities()` |
| 预期结果 | 返回所有已注册的能力列表，包含 id/skillName/type/name/description |
| 优先级 | P0 |

### TC-REG-03：按类型查询能力

| 项目 | 内容 |
|------|------|
| 前置条件 | 注册表中同时存在 web_api 和 python_script 类型能力 |
| 测试步骤 | 调用 `capabilityRegistry.getCapabilitiesByType('web_api')` |
| 预期结果 | 仅返回 web_api 类型的能力 |
| 优先级 | P1 |

### TC-REG-04：按名称查询单个能力

| 项目 | 内容 |
|------|------|
| 前置条件 | 注册表中存在名为 `query_scada_data` 的能力 |
| 测试步骤 | 调用 `capabilityRegistry.getCapabilityByName('query_scada_data')` |
| 预期结果 | 返回该能力的完整配置 |
| 优先级 | P0 |

### TC-REG-05：能力启用/禁用

| 项目 | 内容 |
|------|------|
| 前置条件 | 注册表中存在能力 |
| 测试步骤 | 调用 `capabilityRegistry.toggleCapability('query_scada_data', false)` |
| 预期结果 | 该能力 marked as disabled，后续查询不包含该能力 |
| 优先级 | P0 |

### TC-REG-06：重复技能名称不重复注册

| 项目 | 内容 |
|------|------|
| 前置条件 | 注册表中已存在某技能的能力 |
| 测试步骤 | 再次调用 `capabilityRegistry.initialize()` |
| 预期结果 | 不产生重复注册，注册表数量不变 |
| 优先级 | P1 |

---

## 2. httpApi 工具 — Web API 调用

### TC-API-01：成功调用 GET API

| 项目 | 内容 |
|------|------|
| 前置条件 | 域名白名单包含 `httpbin.org` |
| 测试步骤 | 调用 `httpApi` 工具，method=GET，url=`https://httpbin.org/get?foo=bar` |
| 预期结果 | 返回 200 响应体，解析为可读文本 |
| 优先级 | P0 |

### TC-API-02：成功调用 POST API

| 项目 | 内容 |
|------|------|
| 前置条件 | 域名白名单包含 `httpbin.org` |
| 测试步骤 | 调用 `httpApi` 工具，method=POST，url=`https://httpbin.org/post`，body=`{"key":"value"}` |
| 预期结果 | 返回 200 响应体，包含发送的 JSON 数据 |
| 优先级 | P0 |

### TC-API-03：域名不在白名单中被拒绝

| 项目 | 内容 |
|------|------|
| 前置条件 | 域名白名单仅包含 `example.com` |
| 测试步骤 | 调用 `httpApi` 工具，url=`https://malicious-site.com/api` |
| 预期结果 | 抛出错误："API domain 'malicious-site.com' is not in allowed whitelist" |
| 优先级 | P0 |

### TC-API-04：环境变量注入

| 项目 | 内容 |
|------|------|
| 前置条件 | 环境变量 `SCADA_API_TOKEN=test_token_123` 已设置，域名白名单包含 `httpbin.org` |
| 测试步骤 | 调用 `httpApi` 工具，headers=`{"Authorization":"Bearer ${SCADA_API_TOKEN}"}` |
| 预期结果 | 实际发送的 header 中 Authorization 值为 `Bearer test_token_123` |
| 优先级 | P0 |

### TC-API-05：请求超时

| 项目 | 内容 |
|------|------|
| 前置条件 | 域名白名单包含 `httpbin.org` |
| 测试步骤 | 调用 `httpApi` 工具，url=`https://httpbin.org/delay/10`，timeout=2000 |
| 预期结果 | 2 秒后超时，抛出超时错误 |
| 优先级 | P1 |

### TC-API-06：HTTP 错误码处理

| 项目 | 内容 |
|------|------|
| 前置条件 | 域名白名单包含 `httpbin.org` |
| 测试步骤 | 调用 `httpApi` 工具，url=`https://httpbin.org/status/500` |
| 预期结果 | 返回 HTTP 500 状态码及错误信息，不抛出异常而是返回错误描述给 Agent |
| 优先级 | P1 |

### TC-API-07：响应体大小限制

| 项目 | 内容 |
|------|------|
| 前置条件 | 域名白名单包含 `httpbin.org` |
| 测试步骤 | 调用 `httpApi` 工具，url=`https://httpbin.org/bytes/2000000`（2MB） |
| 预期结果 | 响应体超过 1MB 限制，抛出错误 |
| 优先级 | P1 |

### TC-API-08：响应格式化（response_mapping）

| 项目 | 内容 |
|------|------|
| 前置条件 | 域名白名单包含 `httpbin.org` |
| 测试步骤 | 调用 `httpApi` 工具，url=`https://httpbin.org/get`，response_mapping=`{"url":"请求URL","headers":"请求头"}` |
| 预期结果 | 返回格式化文本：`请求URL: ...\n请求头: ...` |
| 优先级 | P0 |

---

## 3. pythonRunner 工具 — Python 脚本执行

### TC-PY-01：成功执行 Python 脚本

| 项目 | 内容 |
|------|------|
| 前置条件 | `scripts/test/echo_test.py` 存在，输出 `{"status":"ok","message":"hello"}` |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/test/echo_test.py`，params=`{}` |
| 预期结果 | 返回脚本输出，解析为可读文本 |
| 优先级 | P0 |

### TC-PY-02：参数传递（stdin JSON）

| 项目 | 内容 |
|------|------|
| 前置条件 | `scripts/test/params_test.py` 存在，读取 stdin JSON 并回显参数 |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/test/params_test.py`，params=`{"name":"test","value":42}` |
| 预期结果 | 脚本接收到参数并正确回显 |
| 优先级 | P0 |

### TC-PY-03：脚本路径不在白名单中被拒绝

| 项目 | 内容 |
|------|------|
| 前置条件 | 无 |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`../../../etc/passwd.py` |
| 预期结果 | 抛出错误："Script path must be within 'scripts/' directory" |
| 优先级 | P0 |

### TC-PY-04：脚本不存在

| 项目 | 内容 |
|------|------|
| 前置条件 | 无 |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/nonexistent.py` |
| 预期结果 | 抛出错误："Script file not found: scripts/nonexistent.py" |
| 优先级 | P0 |

### TC-PY-05：脚本执行超时

| 项目 | 内容 |
|------|------|
| 前置条件 | `scripts/test/timeout_test.py` 存在，sleep 60 秒 |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/test/timeout_test.py`，timeout=2000 |
| 预期结果 | 2 秒后超时，进程被 kill，抛出超时错误 |
| 优先级 | P0 |

### TC-PY-06：脚本输出非 JSON 格式

| 项目 | 内容 |
|------|------|
| 前置条件 | `scripts/test/plain_text.py` 存在，输出纯文本 `Hello World` |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/test/plain_text.py` |
| 预期结果 | 返回原始文本，不因 JSON 解析失败而报错 |
| 优先级 | P1 |

### TC-PY-07：危险函数检测（静态分析）

| 项目 | 内容 |
|------|------|
| 前置条件 | `scripts/test/dangerous.py` 存在，包含 `os.system('ls')` |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/test/dangerous.py` |
| 预期结果 | 抛出错误："Script contains dangerous function calls: os.system" |
| 优先级 | P0 |

### TC-PY-08：脚本退出码非零

| 项目 | 内容 |
|------|------|
| 前置条件 | `scripts/test/error_test.py` 存在，`sys.exit(1)` |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/test/error_test.py` |
| 预期结果 | 返回错误信息，包含退出码和 stderr 内容 |
| 优先级 | P1 |

### TC-PY-09：输出大小限制

| 项目 | 内容 |
|------|------|
| 前置条件 | `scripts/test/large_output.py` 存在，输出 200KB 数据 |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/test/large_output.py` |
| 预期结果 | 输出超过 100KB 限制，被截断或抛出错误 |
| 优先级 | P1 |

---

## 4. 安全设计

### TC-SEC-01：域名白名单管理

| 项目 | 内容 |
|------|------|
| 前置条件 | 无 |
| 测试步骤 | 调用 `capabilityRegistry.addAllowedDomain('api.example.com')`，然后验证 `isDomainAllowed('api.example.com')` 为 true，`isDomainAllowed('evil.com')` 为 false |
| 预期结果 | 白名单机制正常工作 |
| 优先级 | P0 |

### TC-SEC-02：环境变量注入拒绝不存在的变量

| 项目 | 内容 |
|------|------|
| 前置条件 | 环境变量 `NONEXISTENT_VAR` 未设置 |
| 测试步骤 | 调用 `injectEnvVars('${NONEXISTENT_VAR}')` |
| 预期结果 | 保持原样 `${NONEXISTENT_VAR}` 或抛出警告，不泄露系统环境变量 |
| 优先级 | P1 |

### TC-SEC-03：Python 脚本网络隔离

| 项目 | 内容 |
|------|------|
| 前置条件 | `scripts/test/network_test.py` 尝试访问外部 URL |
| 测试步骤 | 调用 `pythonRunner` 工具，script=`scripts/test/network_test.py` |
| 预期结果 | 脚本被禁止访问网络，抛出错误（如果网络隔离已启用） |
| 优先级 | P2 |

---

## 5. Agent 集成 — 端到端测试

### TC-E2E-01：Agent 识别并调用 Web API 能力

| 项目 | 内容 |
|------|------|
| 前置条件 | `water-quality-analysis` 技能已启用，声明了 `query_scada_data` web_api 能力 |
| 测试步骤 | 通过 chat API 发送消息："当前进水池的水质参数是多少？" |
| 预期结果 | execution_steps 中包含 `api_call` 类型步骤，Agent 回复中包含水质参数 |
| 优先级 | P0 |

### TC-E2E-02：Agent 识别并执行 Python 脚本能力

| 项目 | 内容 |
|------|------|
| 前置条件 | `water-dosing-optimization` 技能已启用，声明了 `calculate_carbon_source` python_script 能力 |
| 测试步骤 | 通过 chat API 发送消息："当前进水 TN 25mg/L，需要加多少碳源？" |
| 预期结果 | execution_steps 中包含 `python_script` 类型步骤，Agent 回复中包含加药量建议 |
| 优先级 | P0 |

### TC-E2E-03：Agent 组合调用 API + Python 脚本

| 项目 | 内容 |
|------|------|
| 前置条件 | 两个技能均已启用 |
| 测试步骤 | 通过 chat API 发送消息："当前水质需要调整加药量吗？" |
| 预期结果 | execution_steps 中包含 `api_call` 和 `python_script` 两种类型步骤，Agent 回复综合了两个结果 |
| 优先级 | P1 |

### TC-E2E-04：能力未启用时不调用

| 项目 | 内容 |
|------|------|
| 前置条件 | `query_scada_data` 能力已禁用 |
| 测试步骤 | 通过 chat API 发送消息："当前进水池的水质参数是多少？" |
| 预期结果 | execution_steps 中不包含 `api_call` 类型步骤，Agent 使用其他方式回答或告知无法获取 |
| 优先级 | P1 |

---

## 6. 测试脚本结构

```
server/tests/
├── unit/
│   ├── capabilityRegistry.test.ts    # TC-REG-01 ~ TC-REG-06
│   ├── httpApi.test.ts               # TC-API-01 ~ TC-API-08
│   └── pythonRunner.test.ts          # TC-PY-01 ~ TC-PY-09
├── integration/
│   └── e2e.test.ts                   # TC-E2E-01 ~ TC-E2E-04
├── fixtures/
│   ├── skills/                       # 测试用技能定义
│   │   └── water-quality-analysis/SKILL.md
│   └── scripts/                      # 测试用 Python 脚本
│       ├── test/
│       │   ├── echo_test.py
│       │   ├── params_test.py
│       │   ├── timeout_test.py
│       │   ├── plain_text.py
│       │   ├── dangerous.py
│       │   ├── error_test.py
│       │   └── large_output.py
│       └── dosing/
│           └── carbon_source_calc.py
└── helpers/
    └── mockServer.ts                 # 测试服务器/Mock API
```
