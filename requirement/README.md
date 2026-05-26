# WAgent — AI Agent 智能体运行平台

> **以水处理工艺为原型场景的 ReAct 模式 AI Agent 平台**

[产品概述](#1-产品概述) · [业务场景](#2-核心业务场景水处理工艺智能运维) · [功能需求](#3-功能需求) · [技术架构](#4-技术架构) · [数据库设计](#5-数据库设计) · [前端架构](#6-前端架构) · [部署架构](#7-部署架构) · [扩展性设计](#8-扩展性设计) · [与OpenClaw对比](#9-与-openclaw-对比) · [版本规划](#10-版本规划) · [术语表](#a-术语表)

---

## 1. 产品概述

### 1.1 产品定位

WAgent 是一个面向工业/企业场景的 **边缘自治闭环执行系统**，以 **水处理工艺** 为原型场景，提供一套完整的 Agent 运行时框架。核心能力包括：

- **多技能（Skill）管理**：Markdown 驱动的领域知识注入
- **多工具（Tool）编排**：知识检索、命令执行、MCP 协议扩展
- **知识库（Knowledge）集成**：自动分块、全文搜索、上下文注入
- **Webhook 集成**：外部系统触发 + SSE 流式回传
- **多轮会话**：持久化历史、执行追踪、流式输出

### 1.2 目标用户

- 工业自动化领域的运维工程师（水处理、化工、电力等）
- 需要 Agent 能力的企业 IT 团队
- 希望快速构建领域 Agent 的开发者

### 1.3 技术栈

| 层 | 技术选型 |
|----|----------|
| 前端框架 | React 18 + TypeScript + Ant Design |
| 构建工具 | Vite 6 |
| 后端框架 | Express.js + TypeScript |
| Agent 框架 | **LangGraph + LangChain**（ReAct 模式） |
| 数据库 | **MySQL 8.0 + FULLTEXT 索引** |
| 认证 | JWT (jsonwebtoken) + bcrypt |
| 实时通信 | SSE (Server-Sent Events) |

### 1.4 设计原则

- **ReAct 优先**：基于 LangGraph 的 ReAct 模式，让 Agent 自主决定何时调用工具
- **配置驱动**：模型、工具、技能、知识库均可通过 UI 配置，无需改代码
- **文件即定义**：Skills 以 Markdown 文件定义，修改即生效，版本可控
- **事件驱动**：SSE 实时推送执行事件，支持外部系统集成
- **轻量部署**：MySQL + Node.js，无需复杂的分布式基础设施

---

## 2. 核心业务场景：水处理工艺智能运维

### 2.1 场景架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    水处理工艺 Agent 场景                          │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  SCADA/PLC  │──→│  WAgent      │──→│  控制指令/建议    │    │
│  │  传感器数据  │   │  Agent 分析  │   │  运维操作指导     │    │
│  └─────────────┘   └──────┬───────┘   └──────────────────┘    │
│                           │                                    │
│                    ┌──────┴───────┐                           │
│                    │  知识增强     │                           │
│                    │  - 工艺规范   │                           │
│                    │  - 操作手册   │                           │
│                    │  - 历史案例   │                           │
│                    │  - 应急预案   │                           │
│                    └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 场景一：水处理工艺智能运维

**用户故事**：运维人员通过对话界面询问系统状态，Agent 自动调用工具分析数据、检索知识库、执行诊断命令并给出操作建议。

**业务流程**：
```
用户输入 → Agent 分析意图 → 选择工具 → 执行诊断 → 返回结果
                          ↘ 检索知识库 → 生成建议
```

**典型对话**：
```
用户: 当前进水池 pH 值偏高，应该怎么处理？

Agent 执行流程：
  1. [agent_node] 分析用户意图 → 需要水质分析 + 工艺知识
  2. [knowledge_retrieval] 检索知识库 → 找到"高pH处理规范"文档
  3. [agent_node] 结合知识生成建议 → 加酸调节方案
  4. [tool_call] exec_command → 查询当前加药泵状态
  5. [agent_node] 综合诊断结果 → 输出操作建议

回复: 进水池 pH 偏高（当前值 8.5，标准范围 6.5-7.5）。
     根据工艺规范，建议：
     1. 启动 P-203 加酸泵，设定流量 15L/h
     2. 每 15 分钟检测一次 pH，直至恢复正常范围
     3. 当前加药泵 P-203 状态：就绪，可用
```

### 2.3 场景二：外部系统联动（Webhook）

**用户故事**：SCADA 系统通过 Webhook 推送传感器数据，Agent 自动分析并返回控制指令，支持流式输出。

**业务流程**：
```
SCADA 推送数据 → WAgent 接收 → 流式执行分析 → SSE 实时回传
```

**典型场景**：
- 传感器数据异常自动推送告警
- 定时巡检数据自动分析
- 设备状态变更自动触发评估

### 2.4 场景三：知识库驱动的决策

**用户故事**：用户提出专业问题，Agent 自动从知识库中检索相关技术文档，结合领域规则给出精准回答。

**水处理知识库包含**：
- 工艺操作规程（A/O 工艺、SBR 工艺、MBR 工艺等）
- 水质标准与限值（GB 18918-2002 等）
- 设备操作手册（加药泵、鼓风机、刮泥机等）
- 应急预案（毒性冲击、设备故障、停电等）
- 历史故障案例与处理经验

### 2.5 技能目录（水处理领域示例）

| 技能 | 描述 |
|------|------|
| `water-quality-analysis` | 水质参数分析与异常诊断 |
| `water-toxicity-detection` | 进水毒性检测与分级响应 |
| `coordinated-line-switch-eval` | 联动换线评估与执行 |
| `water-dosing-optimization` | 加药量优化计算 |
| `water-equipment-diagnosis` | 设备故障诊断与维护建议 |
| `water-emergency-response` | 应急处置方案生成 |

---

## 3. 功能需求

### 3.1 核心功能模块

#### 3.1.1 智能体对话（Agent Chat）
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-01 | 多轮会话 | P0 | 支持创建、切换、删除会话，自动滚动 |
| F-02 | 流式输出 | P0 | SSE 实时流式显示 Agent 回复 |
| F-03 | 工具调用 | P0 | Agent 主动调用工具（知识检索、命令执行等） |
| F-04 | 执行日志 | P1 | 右侧面板展示执行步骤、耗时、结果 |
| F-05 | 会话标题 | P1 | 自动生成会话标题 |
| F-06 | 消息持久化 | P0 | 所有对话消息存储到 MySQL |
| F-07 | 外部消息轮询 | P1 | 自动检测 webhook 等外部消息并展示 |
| F-08 | 收起/展开面板 | P2 | 左侧会话列表和右侧执行日志可折叠 |

#### 3.1.2 技能管理（Skills）
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-09 | Skill 文件扫描 | P0 | 启动时自动扫描 skills/ 目录下的 SKILL.md |
| F-10 | 技能启用/禁用 | P0 | 通过 UI 切换技能状态 |
| F-11 | 多技能组合 | P0 | 支持同时选择多个技能，合并 system prompt |
| F-12 | 技能引用文档摄取 | P1 | 自动将 references/、assets/ 下的 .md 文件存入知识库 |
| F-13 | 技能创建/编辑/删除 | P1 | CRUD 操作 |
| F-14 | 技能目录查询 | P1 | 工具 skill_catalog 列出所有可用技能 |

#### 3.1.3 工具管理（Tools）
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-15 | 内置工具注册 | P0 | current_time、knowledge_lookup、skill_catalog、exec_command |
| F-16 | 工具启用/禁用 | P0 | 通过 UI 切换工具状态 |
| F-17 | MCP 工具扩展 | P1 | 支持文件系统 MCP、HTTP MCP 等协议 |
| F-18 | 命令安全校验 | P0 | exec_command 白名单 + 黑名单模式匹配 |
| F-19 | 工具动态参数 | P1 | 通过 Zod schema 定义工具参数 |

#### 3.1.4 知识库管理（Knowledge）
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-20 | 文档入库 | P0 | 上传文档自动分块存储 |
| F-21 | 全文搜索 | P0 | MySQL FULLTEXT 搜索，支持降级到 LIKE |
| F-22 | 自动检索注入 | P0 | autoKnowledgeRetrieval 模式下自动检索并注入上下文 |
| F-23 | 手动知识查询 | P1 | knowledge_lookup 工具按关键词搜索 |
| F-24 | 分块管理 | P1 | 查看文档分块结果 |
| F-25 | 分块参数配置 | P2 | 可配置 chunk_size 和 chunk_overlap |

#### 3.1.5 Webhook 集成
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-26 | Webhook 端点管理 | P0 | CRUD 管理 webhook 接收端点 |
| F-27 | Bearer Key 认证 | P0 | 每个端点独立 Bearer Key |
| F-28 | 外部触发执行 | P0 | 接收 POST 请求后触发 Agent 执行 |
| F-29 | SSE 流式回传 | P0 | 事件缓冲 + 客户端连接后重放 |
| F-30 | 立即确认返回 | P0 | 不等待 Agent 完成，立即返回 executionId |
| F-31 | 消息来源标记 | P1 | 区分 user 和 webhook 来源的消息 |

#### 3.1.6 执行追踪（Execution）
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-32 | 执行记录创建 | P0 | 每次 Agent 执行创建执行记录 |
| F-33 | 执行步骤记录 | P0 | 记录 LLM 调用、工具调用、知识检索等步骤 |
| F-34 | 执行状态追踪 | P0 | pending → running → completed/failed |
| F-35 | 耗时统计 | P1 | 记录每个步骤的执行耗时 |
| F-36 | 知识上下文快照 | P1 | 保存检索到的知识上下文 |

#### 3.1.7 用户认证（Auth）
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-37 | 用户登录 | P0 | JWT 认证，7 天有效期 |
| F-38 | 用户注册 | P0 | 支持新用户注册 |
| F-39 | 角色权限 | P1 | 管理员 / 普通用户 |
| F-40 | 用户管理 | P1 | 管理员可管理用户 |

#### 3.1.8 记忆系统（Memories）
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-41 | 长期记忆存储 | P1 | 存储事实、偏好、摘要 |
| F-42 | 记忆搜索 | P1 | FULLTEXT 搜索记忆内容 |
| F-43 | 记忆重要性 | P2 | 重要性评分排序 |

#### 3.1.9 模型配置（Config）
| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F-44 | 模型 Provider 管理 | P0 | 多模型切换，API Key/Base URL 配置 |
| F-45 | LangGraph 配置 | P0 | 最大历史消息数、工具循环开关等 |
| F-46 | 模型角色分配 | P1 | 默认模型 / Planner 模型 / Reviewer 模型 |

### 3.2 非功能需求

| ID | 需求 | 指标 |
|----|------|------|
| NF-01 | SSE 事件缓冲 | 最多缓冲 200 个事件，防止内存泄漏 |
| NF-02 | 工具循环限制 | 默认最多 10 次工具调用，防止无限循环 |
| NF-03 | System Prompt 长度 | 超过 12,000 字符自动降级为 general_assistant |
| NF-04 | 消息历史限制 | 可配置最大历史消息数 |
| NF-05 | SSE 超时回退 | 30 秒超时后从服务器加载消息 |
| NF-06 | 命令安全 | exec_command 白名单 + 危险模式黑名单 |
| NF-07 | 密码加密 | bcrypt 哈希存储 |
| NF-08 | JWT 认证 | 所有 API 需携带有效 token |
| NF-09 | 路径限制 | MCP 文件系统操作限制在工作目录内 |
| NF-10 | Webhook 认证 | Bearer Key + URL Token 双重验证 |
| NF-11 | 错误边界 | 前端 React ErrorBoundary 防止崩溃 |
| NF-12 | 竞态防护 | 发送锁、跨会话消息污染防护 |
| NF-13 | 连接恢复 | SSE 断开后自动回退到 execution polling |
| NF-14 | 配置持久化 | 前端工具/技能选择 localStorage 持久化 |
| NF-15 | 技能热加载 | 修改 SKILL.md 后重启自动同步 |
| NF-16 | 执行日志 | 完整的执行步骤日志，便于排查问题 |
| NF-17 | 缺陷追踪 | DEFECTS.md 持续记录已知问题 |

---

## 4. 技术架构

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│  React SPA (Vite)                                            │
│  ├── Chat（对话界面 + 流式显示 + 外部消息轮询）               │
│  ├── Skills（技能管理 + Markdown 编辑）                      │
│  ├── Tools（工具管理 + 启用/禁用）                           │
│  ├── Knowledge（知识库管理 + 文档入库 + 分块查看）           │
│  ├── Config（模型配置 + LangGraph 配置）                     │
│  ├── Architecture（系统架构可视化）                          │
│  ├── Memories（长期记忆管理）                                │
│  ├── Users（用户管理）                                       │
│  └── SiteSettings（站点设置）                                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST + SSE
┌──────────────────────────┴──────────────────────────────────┐
│                      Application Layer                       │
│  Express.js API Server (Port 8787)                           │
│  ├── Routes（API 端点路由）                                  │
│  │   ├── chat.ts          → 对话接口（流式/非流式）          │
│  │   ├── sessions.ts      → 会话 CRUD + 消息 + 执行查询      │
│  │   ├── skills.ts        → 技能 CRUD                       │
│  │   ├── tools.ts         → 工具 CRUD                       │
│  │   ├── knowledge.ts     → 知识库 CRUD                     │
│  │   ├── webhook.ts       → Webhook 配置管理                │
│  │   ├── webhookEndpoints.ts → Webhook 端点管理             │
│  │   ├── webhookReceiver.ts → Webhook 接收处理（外部触发）   │
│  │   ├── auth.ts          → JWT 认证                        │
│  │   ├── users.ts         → 用户管理                        │
│  │   ├── memory.ts        → 记忆管理                        │
│  │   ├── config.ts        → 模型/LangGraph 配置             │
│  │   ├── executions.ts    → 执行记录查询                    │
│  │   └── health.ts        → 健康检查                        │
│  │                                                           │
│  ├── Services（业务逻辑层）                                  │
│  │   ├── toolRegistry.ts    → 工具注册表                    │
│  │   ├── skillRegistry.ts   → 技能注册表 + System Prompt 构建│
│  │   ├── localSkillLoader.ts → 本地 Skill 文件扫描          │
│  │   ├── knowledgeService.ts → 知识入库 + 搜索              │
│  │   ├── sseService.ts      → SSE 事件管理 + 缓冲重放       │
│  │   ├── sessionService.ts  → 会话 + 消息管理               │
│  │   ├── executionService.ts → 执行记录 + 步骤追踪          │
│  │   └── providerService.ts → LLM 实例创建                  │
│  │                                                           │
│  ├── Graph（Agent 运行时）                                   │
│  │   ├── state.ts           → LangGraph State 定义          │
│  │   ├── builder.ts         → StateGraph 构建               │
│  │   ├── nodes.ts           → Agent/Tool/Knowledge 节点      │
│  │   ├── runtime.ts         → 同步执行运行时                 │
│  │   └── runtimeStreaming.ts → 流式执行运行时               │
│  │                                                           │
│  └── Tools（内置工具）                                       │
│      ├── currentTime.ts       → 当前时间查询                 │
│      ├── knowledgeLookup.ts   → 知识库搜索                   │
│      ├── skillCatalog.ts      → 技能目录查询                 │
│      ├── execCommand.ts       → 本地命令执行（安全校验）     │
│      └── mcpTool.ts           → MCP 协议工具扩展             │
└──────────────────────────┬──────────────────────────────────┘
                           │ MySQL Connection Pool
┌──────────────────────────┴──────────────────────────────────┐
│                      Persistence Layer                       │
│  MySQL 8.0                                                   │
│  ├── agent_sessions        → 会话表                          │
│  ├── agent_messages        → 消息表（user/assistant/tool）   │
│  ├── executions            → 执行记录表                      │
│  ├── execution_steps       → 执行步骤表                      │
│  ├── agent_skills          → 技能表                          │
│  ├── agent_tools           → 工具表                          │
│  ├── knowledge_documents   → 知识文档表                      │
│  ├── knowledge_chunks      → 知识分块表（FULLTEXT 索引）     │
│  ├── users                 → 用户表                          │
│  ├── memories              → 长期记忆表                      │
│  ├── webhook_endpoints     → Webhook 端点表                  │
│  ├── langgraph_config      → LangGraph 配置表               │
│  └── providers             → 模型提供商表                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 目录结构

```
wagent/
├── server/                    # 后端
│   ├── src/
│   │   ├── config/           # 配置（env、database）
│   │   ├── graph/            # LangGraph Agent 运行时
│   │   │   ├── state.ts      # State 定义
│   │   │   ├── builder.ts    # Graph 构建
│   │   │   ├── nodes.ts      # Agent/Tool/Knowledge 节点
│   │   │   ├── runtime.ts    # 同步运行时
│   │   │   └── runtimeStreaming.ts  # 流式运行时
│   │   ├── middleware/       # Express 中间件
│   │   │   ├── auth.ts       # JWT 认证
│   │   │   ├── errorHandler.ts
│   │   │   └── logger.ts
│   │   ├── models/           # 数据模型（12 个）
│   │   ├── routes/           # API 路由（13 个）
│   │   ├── services/         # 业务逻辑（8 个）
│   │   ├── tools/            # 内置工具（5 个）
│   │   └── index.ts          # 入口
│   └── package.json
├── web/                       # 前端
│   ├── src/
│   │   ├── api/              # API 客户端
│   │   ├── components/       # 可复用组件（8 个）
│   │   ├── config/           # 前端配置
│   │   ├── context/          # React Context（Auth）
│   │   ├── pages/            # 页面组件（10 个）
│   │   ├── styles/           # 全局样式
│   │   ├── App.tsx           # 路由 + ErrorBoundary
│   │   └── main.tsx          # 入口
│   └── vite.config.ts        # Vite 配置（含 SSE 代理）
├── skills/                    # 技能定义
│   ├── coordinated-line-switch-eval/
│   ├── multi-agent-orchestration/
│   ├── water-*/              # 水处理领域技能
│   └── local/                # 本地技能
├── requirement/               # 需求与设计文档
└── DEFECTS.md                 # 缺陷追踪
```

### 4.3 Agent 运行时设计

#### 4.3.1 LangGraph StateGraph

WAgent 的核心是 LangGraph 的 `StateGraph`，实现 ReAct 循环：

```
[START] ──→ [knowledge_retrieval] ──→ [agent] ──→ [tools] ──→ [agent] ──→ ... ──→ [END]
              ↑ (可选)                     ↘ no tools ↗
```

**State 字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `messages` | `BaseMessage[]` | 消息历史（LangGraph 自动合并） |
| `sessionId` | `string` | 会话 ID |
| `executionId` | `string` | 执行记录 ID |
| `selectedTools` | `string[]` | 选中的工具名称 |
| `selectedSkills` | `string[]` | 选中的技能名称 |
| `knowledgeContext` | `string[]` | 检索到的知识上下文 |
| `currentStep` | `number` | 当前步骤索引 |
| `toolCallCount` | `number` | 工具调用次数（防无限循环） |
| `maxToolCalls` | `number` | 最大允许工具调用次数（默认 10） |

**节点设计**：

1. **Agent Node** — 构建 system prompt（skills + tools + knowledge），获取 LLM 实例并绑定工具，流式调用 LLM
2. **Tool Node** — 包装 LangGraph 的 `ToolNode`，执行工具调用并收集结果
3. **Knowledge Retrieval Node** — 可选节点，自动检索知识库并注入上下文

#### 4.3.2 路由逻辑

```typescript
function shouldCallTools(state): 'tools' | END {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    if (state.toolCallCount >= state.maxToolCalls) return END;  // 防无限循环
    if (!toolLoopEnabled && state.toolCallCount > 0) return END;  // 可禁用循环
    return 'tools';
  }
  return END;
}
```

#### 4.3.3 Agent 执行流程

```
1. 用户消息进入 → 创建 Execution 记录（pending）
2. 加载历史消息 → 构建 LangGraph State
3. [可选] 知识检索节点 → 搜索知识库，注入上下文
4. Agent 节点 → 构建 system prompt（skills + tools）→ 调用 LLM
5. 判断是否需要调用工具：
   - 是 → 工具节点执行 → 回到 Agent 节点（循环，最多 maxToolCalls 次）
   - 否 → 结束，返回回复
6. 保存所有新产生的消息（assistant + tool）
7. 更新 Execution 状态为 completed
8. 通过 SSE 实时推送执行事件
```

### 4.4 System Prompt 构建

```
toolGuidance + corePrompt
```

- **toolGuidance**：列出所有可用工具的名称和描述，告诉模型何时使用工具
- **corePrompt**：
  - 单个 skill：直接使用其 system_prompt
  - 多个 skill：合并为多角色提示词
  - 无 skill：降级为 `general_assistant`
  - 过长（>12,000 字符）：强制降级为 `general_assistant`

**工具引导注入示例**：
```markdown
## 可用工具

你拥有以下工具，可以根据需要主动调用：

- **knowledge_lookup**: 在知识库中搜索相关内容
- **exec_command**: 执行本地 CLI 命令和脚本

调用规则：
1. 当用户的问题需要你执行具体操作时，应优先调用相应工具
2. 调用工具时，请使用工具调用格式，不要只是在文字中提及工具名称
```

**多技能组合示例**：
```markdown
你同时具备以下多种能力，请根据用户的问题灵活运用：

## 角色 1：联动换线评估与执行
...

## 角色 2：进水毒性检测与分级
...
```

### 4.5 流式输出设计

#### 4.5.1 SSE 事件类型
| 事件 | 说明 |
|------|------|
| `connected` | SSE 连接建立确认 |
| `input` | 用户输入已接收 |
| `output` | 模型输出内容块（isPartial=true 为增量） |
| `step` | 执行步骤更新（llm_call / tool_call / knowledge_retrieval） |
| `error` | 执行错误 |
| `complete` | 执行完成（done/error） |

#### 4.5.2 事件缓冲机制

WAgent 独有的设计，解决了 webhook 场景下「执行已经开始但前端还没连接」的问题：

```
Webhook 触发 → runAgentStreaming → sseService.emit() → [无客户端连接] → 事件缓冲
                                                                    ↓
客户端连接 → sseService.registerClient() → 检测缓冲事件 → setImmediate() 重放
```

- 无客户端连接时，事件缓存在 `Map<executionId, BufferedEvent[]>` 中
- 最多缓冲 200 个事件，超出后移除最旧的（防止内存泄漏）
- 客户端连接后立即重放，异步执行避免阻塞注册

#### 4.5.3 前端流式处理
- 正常对话：用户发送 → 获取 executionId → 建立 SSE 连接 → 实时显示
- Webhook 消息：轮询检测新消息 → 发现 running 执行 → 建立 SSE 连接 → 接收缓冲事件重放

### 4.6 Webhook 集成设计

#### 4.6.1 请求流程
```
外部系统 POST → /webhook/:token (Authorization: Bearer <key>)
  → 验证 bearer_key 和 URL token
  → 保存用户消息（source: 'webhook'）
  → 创建 Execution 记录
  → 异步启动 runAgentStreaming
  → 立即返回 {success, sessionId, executionId, timestamp}
```

#### 4.6.2 双重认证
| 验证项 | 说明 |
|--------|------|
| Bearer Key | Authorization 头中的 token，对应 `webhook_endpoints.bearer_key` |
| URL Token | 路径中的 token，对应 `webhook_url` 的末尾部分 |

### 4.7 知识库设计

#### 4.7.1 文档入库流程
```
文档内容 → createDocument → chunkText（切块）→ createChunk（存储分块）→ updateDocumentStatus
```

- 默认分块大小 500 字符，重叠 50 字符
- 可通过 LangGraph 配置调整

#### 4.7.2 搜索策略
```sql
-- 优先：FULLTEXT 全文搜索（带相关性排序）
SELECT c.*, d.title as doc_title,
       MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance
FROM knowledge_chunks c
JOIN knowledge_documents d ON c.document_id = d.id
WHERE MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE)
ORDER BY relevance DESC
LIMIT ?

-- 降级：LIKE 模糊匹配（FULLTEXT 不可用时）
```

### 4.8 技能系统设计

#### 4.8.1 技能文件格式（SKILL.md）
```markdown
---
name: coordinated-line-switch-eval
description: 评估并执行联动换线...
metadata:
  openclaw:
    requires:
      env: [SCADA_BASE_URL]
---

# 联动换线评估与执行

## 1. 能力定义
...

## 2. References
...
```

#### 4.8.2 加载机制
```
启动 → scanSkillFolders() → 扫描 skills/ 目录
  → 解析 frontmatter（name、description）
  → 提取 markdown body 作为 system_prompt
  → 同步到 agent_skills 表
  → 摄取 references/ 和 assets/ 下的 .md 到知识库
```

### 4.9 安全设计

#### 4.9.1 命令执行安全
| 机制 | 实现 |
|------|------|
| 白名单 | 仅允许预定义命令（echo、cat、ls、git、python 等） |
| 黑名单 | 正则匹配危险模式（rm -rf /、wget|sh、curl|sh 等） |
| 路径限制 | MCP 文件系统操作限制在工作目录内 |
| 超时控制 | 默认 30 秒超时 |

#### 4.9.2 Webhook 安全
| 机制 | 实现 |
|------|------|
| Bearer Key | 每个端点独立生成 |
| URL Token | 随机生成的 URL 路径段 |
| 禁用检查 | 端点可禁用，返回 403 |

---

## 5. 数据库设计

### 5.1 实体关系图
```
agent_sessions ──┐
                 ├─→ agent_messages
                 ├─→ executions ──→ execution_steps
                 └─→ webhook_endpoints

agent_skills ──┐
               ├─→ skills ↔ tools（N:N，通过 selected 字段关联）
agent_tools ───┘

knowledge_documents ──→ knowledge_chunks

users ──→ 认证

memories ──→ 长期记忆

providers ──→ 模型配置
langgraph_config ──→ Agent 运行时配置
```

### 5.2 核心数据表
| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `agent_sessions` | 会话 | id, title, created_at, updated_at |
| `agent_messages` | 消息 | id, session_id, role, content, tool_calls, source |
| `executions` | 执行记录 | id, session_id, input, status, output, error, duration_ms |
| `execution_steps` | 执行步骤 | id, execution_id, type, name, input, output, duration_ms |
| `agent_skills` | 技能 | id, name, display_name, system_prompt, enabled, built_in, file_path |
| `agent_tools` | 工具 | id, name, display_name, description, parameters_schema, enabled |
| `knowledge_documents` | 知识文档 | id, title, source, content, status, chunk_count |
| `knowledge_chunks` | 知识分块 | id, document_id, chunk_index, content, char_count |
| `users` | 用户 | id, username, password_hash, is_admin |
| `memories` | 长期记忆 | id, type, content, context, importance |
| `webhook_endpoints` | Webhook 端点 | id, session_id, webhook_url, bearer_key, selected_tools, selected_skills |
| `langgraph_config` | LangGraph 配置 | 最大历史消息、工具循环开关、知识检索开关等 |
| `providers` | 模型提供商 | id, name, api_base_url, api_key, default_model, is_active |

### 5.3 关键索引
| 表 | 索引 | 用途 |
|----|------|------|
| `knowledge_chunks` | FULLTEXT(content) | 全文搜索 |
| `agent_messages` | (session_id, created_at) | 按会话查询消息 |
| `executions` | (session_id, created_at) | 按会话查询执行 |
| `agent_skills` | (name, enabled) | 按名称和状态查询 |

---

## 6. 前端架构

### 6.1 页面组件
| 页面 | 路由 | 功能 |
|------|------|------|
| Chat | `/` | 主对话界面 |
| Skills | `/skills` | 技能管理 |
| Tools | `/tools` | 工具管理 |
| Knowledge | `/knowledge` | 知识库管理 |
| Config | `/config` | 模型和 LangGraph 配置 |
| Architecture | `/architecture` | 系统架构可视化 |
| Memories | `/memories` | 长期记忆管理 |
| Users | `/users` | 用户管理（仅管理员） |
| SiteSettings | `/site-settings` | 站点设置 |

### 6.2 组件设计
| 组件 | 职责 |
|------|------|
| Layout | 整体布局（侧边栏 + 主内容区 + 导航） |
| ChatMessage | 单条消息渲染（Markdown + 时间戳） |
| StreamingMessage | 流式消息渲染（步骤 + 内容） |
| ExecutionLog | 执行步骤日志面板 |
| ToolSelector | 工具选择器（复选框列表） |
| SkillSelector | 技能选择器（复选框列表） |
| WebhookEndpointManager | Webhook 端点管理弹窗 |
| PrivateRoute | 路由守卫（需认证/需管理员） |

### 6.3 状态管理
- React Hooks（useState、useEffect、useRef、useCallback）
- Context API（AuthContext 管理用户认证状态）
- localStorage（工具/技能选择持久化）
- SSE ref（避免闭包捕获过期值）

---

## 7. 部署架构

### 7.1 开发环境
```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Vite    │    │ Express  │    │  MySQL   │
│  :5173   │──→ │  :8787   │──→ │  :3306   │
└──────────    └──────────┘    └──────────┘
```

### 7.2 生产环境（推荐）
```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Nginx   │    │  Node.js │    │  MySQL   │
│  :80/443 │──→ │  :8787   │──→ │  :3306   │
│          │    │ (PM2)    │    │          │
└──────────┘    └──────────┘    └──────────┘
     │
     └──→ 静态文件（Vite build 产物）
```

### 7.3 环境变量
| 变量 | 说明 |
|------|------|
| `DATABASE_HOST` | MySQL 主机地址 |
| `DATABASE_PORT` | MySQL 端口 |
| `DATABASE_USER` | 数据库用户名 |
| `DATABASE_PASSWORD` | 数据库密码 |
| `DATABASE_NAME` | 数据库名 |
| `PORT` | 后端服务端口（默认 8787） |
| `OPENAI_API_KEY` | 默认 API Key |
| `OPENAI_BASE_URL` | 默认 API Base URL |
| `OPENAI_MODEL` | 默认模型名称 |
| `JWT_SECRET` | JWT 签名密钥 |

---

## 8. 扩展性设计

WAgent 的框架是 **高度可扩展** 的，所有核心模块均可独立扩展而不影响其他部分。

### 8.1 工具扩展
- 内置工具通过 `BUILT_IN_TOOL_MAP` 注册
- MCP 工具通过 `createMcpTool()` 动态创建
- 新工具只需实现 `StructuredTool` 接口并注册
- 支持领域专用工具（如水处理领域的 PLC 控制工具、水质分析工具）

### 8.2 技能扩展
- 在 `skills/` 下新建文件夹，放置 `SKILL.md`
- 支持引用文档（references/、assets/）自动入库
- 支持旧格式（local/*.md）兼容
- 支持领域专用技能包（化工、电力、制造等）

### 8.3 模型扩展
- 通过 Provider 管理界面添加新模型
- 支持多角色模型（default / planner / reviewer）
- 兼容 OpenAI API 格式的任意模型提供商

### 8.4 领域扩展

虽然 WAgent 以水处理工艺为原型场景，但其架构完全通用，可快速适配其他领域：

| 领域 | 需要的技能 | 需要的工具 |
|------|-----------|-----------|
| **化工生产** | 反应控制、安全评估、排放监测 | 工艺参数查询、DCS 命令执行 |
| **电力运维** | 设备诊断、负荷预测、故障处理 | SCADA 数据查询、操作票执行 |
| **智能制造** | 产线调度、质量检测、设备维护 | MES 数据查询、PLC 指令下发 |
| **智慧城市** | 交通管理、环境监测、应急响应 | IoT 数据查询、控制指令下发 |

**只需替换**：
1. `skills/` 下的领域技能文件
2. 知识库中的领域文档
3. 可选：添加领域专用工具

**核心 Agent 运行时、数据库、前端界面无需任何修改。**

---

## 9. 与 OpenClaw 对比

WAgent 以 OpenClaw 为灵感起点，但在架构设计、功能完整性、生产可用性等方面进行了全面升级。

### 9.1 核心差异

| 维度 | OpenClaw | WAgent |
|------|----------|--------|
| **Agent 模式** | 基于规则的指令执行 | **LangGraph ReAct 循环**（Agent → Tools → Agent） |
| **运行时** | 线性执行流程 | **有状态图（StateGraph）**，支持循环、分支、条件路由 |
| **工具循环** | 不支持 | **自动循环调用**，最多 10 次（可配置） |
| **知识检索** | 无内置能力 | **自动检索注入**，Agent 决策前自动检索知识库 |
| **流式输出** | 无 | **SSE 实时流式输出**，带事件缓冲和断线重放 |
| **Webhook** | 无 | **外部触发 + SSE 流式回传 + 事件缓冲** |
| **用户认证** | 无 | **JWT + bcrypt + 角色权限** |
| **部署** | 本地脚本 | **Nginx + PM2 + MySQL 生产级部署** |

### 9.2 六大核心优势

1. **智能决策能力**：基于 LangGraph 的 ReAct 模式，让 Agent 自主决定何时调用工具、调用几次、如何组合，而非硬编码的执行流程

2. **知识驱动**：内置知识库管理系统，支持自动分块、全文搜索、自动检索注入，让 Agent 的回答建立在领域知识基础上

3. **外部系统集成**：Webhook + SSE 流式输出 + 事件缓冲，使 WAgent 可以与 SCADA、监控系统等外部系统无缝对接

4. **生产级可靠性**：错误恢复、超时处理、竞态防护、命令安全校验、token 限制等生产级特性，确保系统在真实环境中稳定运行

5. **配置驱动**：模型、工具、技能、知识库均可通过 UI 配置，修改即生效，无需改动代码或重新部署

6. **轻量部署**：仅需 MySQL + Node.js，无需 Redis、Kafka、Kubernetes 等复杂基础设施，适合边缘计算和资源受限场景

### 9.3 适用场景对比

| 场景 | OpenClaw | WAgent |
|------|----------|--------|
| 简单的定时任务 | ✅ | ✅ |
| 需要知识检索的运维问答 | ❌ | ✅ |
| 多步骤故障诊断 | ❌ | ✅ |
| 外部系统联动（SCADA/监控） | ❌ | ✅ |
| 多领域能力组合 | ❌ | ✅ |
| 流式输出展示 | ❌ | ✅ |
| 执行过程追溯和审计 | ❌ | ✅ |
| 多用户权限管理 | ❌ | ✅ |

### 9.4 本质差异

> OpenClaw 本质上是一个**任务自动化脚本**，而 WAgent 是一个**完整的 Agent 运行平台**。两者的差异不是功能多少的问题，而是架构范式的根本不同：
> - OpenClaw：`if-then` 规则 → 执行命令 → 返回结果
> - WAgent：`ReAct` 循环 → 自主决策 → 多步推理 → 工具调用 → 知识增强 → 流式输出

---

## 10. 版本规划

### v1.0（当前）
- ✅ 基础 ReAct Agent 运行时
- ✅ 多轮会话 + 流式输出
- ✅ 技能管理（Markdown 驱动）
- ✅ 知识库管理（全文搜索）
- ✅ Webhook 集成
- ✅ 用户认证

### v1.1（计划）
- 记忆自动提取与注入
- 多模型编排（Planner + Worker + Reviewer）
- 技能依赖关系解析
- Agent 行为学习（从历史执行中优化工具选择）

### v2.0（远期）
- 多 Agent 协作
- 可视化流程编排
- 插件市场

---

## A. 术语表

| 术语 | 定义 |
|------|------|
| Skill | 领域能力定义，通过 Markdown 文件描述，运行时注入为 system prompt |
| Tool | Agent 可调用的具体功能，如知识检索、命令执行 |
| Execution | 一次完整的 Agent 执行记录，包含输入、输出、步骤 |
| Knowledge Chunk | 知识库文档切分后的内容块，用于全文搜索 |
| SSE | Server-Sent Events，单向实时推送协议 |
| MCP | Model Context Protocol，模型上下文协议，用于扩展工具 |
| ReAct | Reasoning + Acting，Agent 自主推理和行动的模式 |
| StateGraph | LangGraph 的有状态图结构，定义 Agent 的执行流程 |
