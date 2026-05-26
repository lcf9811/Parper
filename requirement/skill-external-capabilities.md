# 需求：Skill 驱动的外部能力调用（Web API + Python 脚本）

## 1. 背景与目标

### 1.1 现状

WAgent 当前已具备：
- `exec_command` 工具：可执行本地命令（需白名单），理论上可执行 `python script.py`
- `mcpTool` 工具：通过 MCP 协议调用外部服务

**存在的问题**：
1. 技能无法**声明式**地定义自己需要调用哪些外部 API 或脚本
2. `exec_command` 是通用命令执行，缺少对 Python 脚本的**参数校验、结果解析、错误处理**
3. MCP 配置复杂，不适合快速接入简单的 HTTP API
4. Agent 在执行技能时，无法自动识别"这个技能需要调某 API"或"这个技能需要跑某 Python 脚本"

### 1.2 目标

让 Skill 文件（SKILL.md）能够**声明式**地定义外部能力调用，包括：
- **Web API 调用**：声明 URL、方法、参数，Agent 执行技能时自动调用
- **Python 脚本执行**：声明脚本路径、输入参数，Agent 执行时自动运行并获取结果

### 1.3 设计原则

- **声明式优先**：在 SKILL.md 的 frontmatter 中声明外部能力，而非硬编码在工具代码中
- **安全可控**：API 调用有白名单域名限制，Python 脚本有路径和沙箱限制
- **结果可消费**：调用结果自动格式化为 LLM 可读的文本，注入执行上下文
- **可独立启用/禁用**：每个声明的外部能力可在 UI 中单独控制

---

## 2. 需求用例

### Case 1：通过 Skill 调用 Web API（水质数据查询）

**场景**：运维人员询问"当前进水池的水质参数是多少？"，Agent 通过 `water-quality-analysis` 技能调用 SCADA 系统 API 获取实时数据。

**Skill 定义**（`skills/water-quality-analysis/SKILL.md`）：
```yaml
---
name: water-quality-analysis
description: 水质参数分析与异常诊断
capabilities:
  - type: web_api
    name: query_scada_data
    description: 从 SCADA 系统查询实时水质参数
    url: "http://192.168.1.100:8080/api/v1/sensor/realtime"
    method: GET
    headers:
      Authorization: "Bearer ${SCADA_API_TOKEN}"
    parameters:
      - name: station_id
        type: string
        required: true
        description: "监测站点ID，如 INLET_POOL_01"
      - name: params
        type: string
        required: false
        description: "参数列表，逗号分隔，如 ph,do,cod,tn,tp"
    response_mapping:
      ph: "进水pH值"
      do: "溶解氧(mg/L)"
      cod: "化学需氧量(mg/L)"
      tn: "总氮(mg/L)"
      tp: "总磷(mg/L)"
---
```

**执行流程**：
```
用户: 当前进水池的水质参数是多少？
  ↓
Agent 分析 → 匹配 water-quality-analysis 技能
  ↓
识别技能声明的 web_api 能力: query_scada_data
  ↓
从用户消息中提取参数: station_id="INLET_POOL_01"
  ↓
调用 http_tool: GET /api/v1/sensor/realtime?station_id=INLET_POOL_01&params=ph,do,cod,tn,tp
  ↓
API 返回: {"ph": 7.2, "do": 3.5, "cod": 45, "tn": 25, "tp": 3.2}
  ↓
按 response_mapping 格式化为自然语言 → 注入 Agent 上下文
  ↓
Agent 综合技能知识 → 生成分析报告（参数是否正常、是否需要调整等）
  ↓
返回用户
```

**安全要求**：
- API 域名必须在配置白名单中（如 `192.168.1.100`）
- 敏感信息（token）通过环境变量注入，不写在 skill 文件中
- 请求超时 30 秒，失败返回错误信息给 Agent

---

### Case 2：通过 Skill 执行 Python 脚本（加药量计算）

**场景**：运维人员问"当前进水 TN 25mg/L，需要加多少碳源？"，Agent 通过 `water-dosing-optimization` 技能执行 Python 计算脚本。

**Skill 定义**（`skills/water-dosing-optimization/SKILL.md`）：
```yaml
---
name: water-dosing-optimization
description: 加药量优化计算
capabilities:
  - type: python_script
    name: calculate_carbon_source
    description: 根据进水水质计算所需碳源投加量
    script: "scripts/dosing/carbon_source_calc.py"
    parameters:
      - name: inflow_tn
        type: number
        required: true
        description: "进水总氮浓度(mg/L)"
      - name: outflow_tn_limit
        type: number
        required: false
        default: 15
        description: "出水总氮限值(mg/L)，默认15"
      - name: flow_rate
        type: number
        required: false
        default: 10000
        description: "处理水量(m³/d)，默认10000"
      - name: carbon_type
        type: string
        required: false
        default: "sodium_acetate"
        description: "碳源类型：sodium_acetate(乙酸钠)/methanol(甲醇)/glucose(葡萄糖)"
    output_format: "table"
---
```

**Python 脚本**（`scripts/dosing/carbon_source_calc.py`）：
```python
#!/usr/bin/env python3
"""根据进水水质计算所需碳源投加量"""
import json
import sys

# 从 stdin 读取 JSON 参数
params = json.loads(sys.stdin.read())

inflow_tn = params["inflow_tn"]
outflow_tn_limit = params.get("outflow_tn_limit", 15)
flow_rate = params.get("flow_rate", 10000)
carbon_type = params.get("carbon_type", "sodium_acetate")

# C/N 比需求（不同碳源）
cn_ratios = {
    "sodium_acetate": 4.0,
    "methanol": 3.5,
    "glucose": 6.0,
}

# 计算需去除的 TN 量
tn_to_remove = inflow_tn - outflow_tn_limit  # mg/L
if tn_to_remove <= 0:
    result = {"status": "ok", "message": f"进水TN({inflow_tn})已低于限值({outflow_tn_limit})，无需加碳源", "dosage_kg_d": 0}
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)

cn_ratio = cn_ratios.get(carbon_type, 4.0)
# 每日碳源需求量(kg/d)
dosage_kg_d = tn_to_remove * cn_ratio * flow_rate / 1000

result = {
    "status": "ok",
    "carbon_type": carbon_type,
    "tn_removed_mg_l": tn_to_remove,
    "cn_ratio": cn_ratio,
    "flow_rate_m3_d": flow_rate,
    "dosage_kg_d": round(dosage_kg_d, 2),
    "dosage_kg_h": round(dosage_kg_d / 24, 2),
    "message": f"建议{carbon_type}投加量：{dosage_kg_d:.2f} kg/d ({dosage_kg_d/24:.2f} kg/h)"
}

print(json.dumps(result, ensure_ascii=False))
```

**执行流程**：
```
用户: 当前进水 TN 25mg/L，需要加多少碳源？
  ↓
Agent 分析 → 匹配 water-dosing-optimization 技能
  ↓
识别技能声明的 python_script 能力: calculate_carbon_source
  ↓
从用户消息中提取参数: inflow_tn=25
  ↓
调用 python_tool: python scripts/dosing/carbon_source_calc.py
   stdin: {"inflow_tn": 25}
  ↓
脚本输出: {"dosage_kg_d": 400.0, "dosage_kg_h": 16.67, ...}
  ↓
按 output_format 格式化为表格 → 注入 Agent 上下文
  ↓
Agent 综合技能知识 → 生成加药建议
  ↓
返回用户: "建议乙酸钠投加量：400.00 kg/d (16.67 kg/h)..."
```

**安全要求**：
- 脚本路径必须在 `scripts/` 目录下（白名单）
- 禁止脚本访问网络（除非明确声明并批准）
- 执行超时 30 秒，CPU/内存有限制
- 脚本输出必须是 JSON 格式，便于 LLM 解析

---

### Case 3：组合调用（API 查询 + Python 计算）

**场景**：运维人员问"当前水质需要调整加药量吗？"

**执行流程**：
```
用户: 当前水质需要调整加药量吗？
  ↓
Agent 分析 → 匹配 water-quality-analysis + water-dosing-optimization 两个技能
  ↓
Step 1: 调用 query_scada_data API → 获取实时水质参数
  ↓
Step 2: 将 API 结果作为参数传递给 calculate_carbon_source 脚本
  ↓
Step 3: 脚本返回计算结果
  ↓
Agent 综合两个技能的知识 → 生成综合诊断报告
  ↓
返回用户: "当前进水TN为25mg/L，超出标准限值。
         建议增加乙酸钠投加量至 400kg/d（当前300kg/d，需增加33%）。
         原因：..."
```

**关键点**：Agent 需要能够将一个能力调用的输出作为另一个能力的输入。

---

## 3. 功能需求

### 3.1 Web API 调用能力

| ID | 需求 | 优先级 | 描述 |
|----|------|--------|------|
| API-01 | 声明式 API 定义 | P0 | 在 SKILL.md frontmatter 中声明 `capabilities`，包含 type/web_api 配置 |
| API-02 | HTTP 工具实现 | P0 | 新建 `httpApi` 内置工具，支持 GET/POST/PUT/DELETE |
| API-03 | 参数提取 | P0 | 从用户消息或上下文自动提取 API 所需参数 |
| API-04 | 环境变量注入 | P0 | 支持 `${ENV_VAR}` 语法注入 header/body 中的敏感信息 |
| API-05 | 响应格式化 | P0 | 按 `response_mapping` 将 JSON 响应转为 LLM 可读文本 |
| API-06 | 域名白名单 | P0 | 配置允许的 API 域名/IP 列表，不在白名单的请求拒绝执行 |
| API-07 | 超时控制 | P1 | 默认 30 秒超时，可配置 |
| API-08 | 错误处理 | P1 | HTTP 错误码映射为可读错误信息返回 Agent |
| API-09 | SSL 验证 | P1 | 可配置是否跳过 SSL 验证（内网环境常用） |
| API-10 | 请求日志 | P1 | 记录 API 调用详情到 execution_steps |

### 3.2 Python 脚本执行能力

| ID | 需求 | 优先级 | 描述 |
|----|------|--------|------|
| PY-01 | 声明式脚本定义 | P0 | 在 SKILL.md frontmatter 中声明 `capabilities`，包含 type/python_script 配置 |
| PY-02 | Python 工具实现 | P0 | 新建 `python_runner` 内置工具，执行指定脚本 |
| PY-03 | 参数传递 | P0 | 通过 stdin 传递 JSON 格式参数给脚本 |
| PY-04 | 输出解析 | P0 | 解析脚本 stdout JSON 输出，格式化后注入 Agent 上下文 |
| PY-05 | 路径白名单 | P0 | 脚本必须在 `scripts/` 目录下，禁止任意路径执行 |
| PY-06 | 超时控制 | P0 | 默认 30 秒超时，超时强制终止进程 |
| PY-07 | 输出格式配置 | P1 | 支持 json/table/text 等输出格式选项 |
| PY-08 | 标准库限制 | P1 | 禁止脚本使用 os.system、subprocess 等系统调用 |
| PY-09 | 依赖管理 | P2 | 支持通过 requirements.txt 声明 Python 依赖 |
| PY-10 | 执行日志 | P1 | 记录脚本输入/输出/耗时/退出码到 execution_steps |

### 3.3 配置管理

| ID | 需求 | 优先级 | 描述 |
|----|------|--------|------|
| CFG-01 | 能力注册 | P0 | 启动时扫描所有 skill 的 capabilities，注册到 capabilityRegistry |
| CFG-02 | 能力启用/禁用 | P0 | 通过 UI 单独控制每个能力的启用状态 |
| CFG-03 | 域名白名单管理 | P0 | UI 管理允许的 API 域名/IP 列表 |
| CFG-04 | 环境变量管理 | P1 | UI 管理技能使用的敏感环境变量（API Token 等） |

### 3.4 Agent 集成

| ID | 需求 | 优先级 | 描述 |
|----|------|--------|------|
| AG-01 | 能力发现 | P0 | 构建 system prompt 时，将技能的 capabilities 描述注入，让 Agent 知道可以调用哪些 API/脚本 |
| AG-02 | 自动调用 | P0 | Agent 根据用户意图自动决定调用哪个能力，并提取参数 |
| AG-03 | 多步组合 | P1 | Agent 能将一个能力的输出作为另一个能力的输入 |
| AG-04 | 能力描述工具 | P0 | 新建 `capability_lookup` 工具，列出所有已注册的 web_api 和 python_script 能力 |

---

## 4. 数据结构设计

### 4.1 能力注册表（内存）

```typescript
interface Capability {
  id: string;              // 自动生成: "skill-name:capability-name"
  skillName: string;       // 所属技能
  type: 'web_api' | 'python_script';
  name: string;            // 能力名称
  description: string;     // 能力描述（注入 system prompt）
  enabled: boolean;        // 是否启用
  config: WebApiConfig | PythonScriptConfig;
}

interface WebApiConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  parameters: ParameterDefinition[];
  response_mapping?: Record<string, string>;
}

interface PythonScriptConfig {
  script: string;          // 相对于项目根目录的路径
  parameters: ParameterDefinition[];
  output_format?: 'json' | 'table' | 'text';
}

interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default?: any;
  description: string;
}
```

### 4.2 execution_steps 扩展

在现有 `execution_steps` 表中，新增 `capability` 类型的步骤：

| type | name | input | output |
|------|------|-------|--------|
| `api_call` | query_scada_data | `{"station_id":"INLET_POOL_01"}` | `{"ph":7.2,"do":3.5,...}` |
| `python_script` | calculate_carbon_source | `{"inflow_tn":25}` | `{"dosage_kg_d":400,...}` |

---

## 5. 安全设计

### 5.1 Web API 安全
| 机制 | 实现 |
|------|------|
| 域名白名单 | 仅允许配置白名单中的域名/IP，拒绝其他请求 |
| 敏感信息 | 通过环境变量注入，不在 skill 文件中明文存储 |
| 方法限制 | 仅支持 GET/POST/PUT/DELETE，禁止其他方法 |
| 超时 | 30 秒默认超时，防止长时间阻塞 |
| 响应体限制 | 限制最大响应体大小（默认 1MB） |

### 5.2 Python 脚本安全
| 机制 | 实现 |
|------|------|
| 路径白名单 | 脚本必须在 `scripts/` 目录下 |
| 进程沙箱 | 使用独立的子进程执行，限制 CPU 时间和内存 |
| 危险函数检测 | 静态分析脚本，禁止 os.system、subprocess、eval、exec 等 |
| 网络隔离 | 默认禁止脚本访问网络（除非明确声明） |
| 超时 | 30 秒超时后强制 kill 进程 |
| 输出限制 | 限制 stdout 输出大小（默认 100KB） |

---

## 6. 实现要点

### 6.1 关键文件变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `server/src/services/capabilityRegistry.ts` | **新建** | 能力注册表，扫描/注册/查询所有技能声明的 capabilities |
| `server/src/tools/httpApi.ts` | **新建** | HTTP API 调用工具 |
| `server/src/tools/pythonRunner.ts` | **新建** | Python 脚本执行工具 |
| `server/src/services/skillRegistry.ts` | **修改** | 解析 SKILL.md frontmatter 中的 `capabilities` 字段，注册到 capabilityRegistry |
| `server/src/graph/nodes.ts` | **修改** | 将 capabilities 描述注入 system prompt |
| `server/src/services/toolRegistry.ts` | **修改** | 注册 httpApi 和 pythonRunner 两个新工具 |
| `web/src/pages/Config.tsx` 或新建页面 | **修改/新建** | 管理域名白名单、环境变量等配置 |

### 6.2 实现顺序建议

1. **第一步**：`capabilityRegistry.ts` — 能力扫描和注册
2. **第二步**：`httpApi.ts` — HTTP API 调用工具 + 域名白名单
3. **第三步**：`pythonRunner.ts` — Python 脚本执行工具 + 安全校验
4. **第四步**：修改 `skillRegistry.ts` — 解析 capabilities 字段
5. **第五步**：修改 `nodes.ts` — system prompt 注入能力描述
6. **第六步**：注册新工具到 `toolRegistry`
7. **第七步**（可选）：前端能力管理界面

---

## 7. 验收标准

### Case 1 验收
- [ ] 在 SKILL.md 中声明 web_api 能力后，Agent 能自动识别并调用
- [ ] API 调用结果正确格式化为 Agent 可读文本
- [ ] 域名不在白名单中的请求被拒绝
- [ ] execution_steps 中记录了 api_call 类型步骤

### Case 2 验收
- [ ] 在 SKILL.md 中声明 python_script 能力后，Agent 能自动识别并执行
- [ ] Python 脚本通过 stdin 接收参数，stdout 输出 JSON 结果
- [ ] 执行结果正确格式化为 Agent 可读文本
- [ ] 脚本路径不在 `scripts/` 目录下的请求被拒绝
- [ ] execution_steps 中记录了 python_script 类型步骤

### Case 3 验收
- [ ] Agent 能在同一执行流中调用多个能力（API + 脚本）
- [ ] Agent 能将一个能力的输出作为另一个能力的输入参数
- [ ] 最终回答综合了所有能力调用的结果
