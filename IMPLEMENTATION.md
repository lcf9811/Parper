# WAgent 实现文档

> 本文件记录项目完整实现细节，供开发参考。

## 项目状态：全部代码已完成，依赖已安装

- **环境**: Windows 10, Node v22, MySQL
- **根目录**: `d:\Documents and Settings\changhuaizhuit\My Documents\workspace\claude_workspace\wagent`
- **待办**: 用户需配置 `server/.env` 中的 MYSQL_PASSWORD 和 OPENAI_API_KEY，然后运行 `start.bat` 或 `npm run dev`

---

## 一、目录结构（已清理）

```
wagent/
├── package.json              # monorepo 根脚本（concurrently）
├── start.bat                 # Windows 交互式启动脚本（菜单选择）
├── README.md                 # 项目说明
├── IMPLEMENTATION.md         # 本文件
├── sql/
│   └── init.sql              # 10张表 + 种子数据
├── server/
│   ├── package.json          # type:module, tsx loader
│   ├── tsconfig.json         # ES2022, ESNext module
│   ├── .env.example
│   ├── .env                  # 需用户配置密码和API Key
│   └── src/
│       ├── index.ts          # Express 入口，挂载8个路由
│       ├── config/
│       │   ├── env.ts        # dotenv 加载环境变量
│       │   └── database.ts   # mysql2/promise 连接池 + query() + closePool()
│       ├── models/           # 数据库 CRUD（均使用 crypto.randomUUID() 生成ID）
│       │   ├── sessionModel.ts    # SessionModel: findAll, findById, create, updateTitle, remove
│       │   ├── messageModel.ts    # MessageModel: findBySession, create, countBySession
│       │   ├── toolModel.ts       # ToolModel: findAll, findEnabled, findByName, upsert, toggleEnabled
│       │   ├── skillModel.ts      # SkillModel: findAll, findEnabled, findByName, create, update, remove, toggleEnabled
│       │   ├── knowledgeModel.ts  # KnowledgeModel: 文档CRUD + 分块CRUD + searchChunks(FULLTEXT/LIKE回退)
│       │   ├── executionModel.ts  # ExecutionModel: CRUD + complete/fail + addStep/getSteps
│       │   └── providerModel.ts   # ProviderModel: LLM Provider CRUD + setActive + LangGraphConfig get/update
│       ├── services/
│       │   ├── sessionService.ts    # 会话/消息管理
│       │   ├── toolRegistry.ts      # 内置工具同步到DB + 按名称过滤
│       │   ├── skillRegistry.ts     # 技能CRUD + buildSystemPrompt(合并多技能)
│       │   ├── knowledgeService.ts  # 文档入库(自动切块500字符) + 搜索
│       │   ├── executionService.ts  # 执行生命周期: create→markRunning→complete/fail + addStep
│       │   └── providerService.ts   # getLLMInstance(): 读DB激活Provider→new ChatOpenAI
│       ├── graph/
│       │   ├── state.ts      # AgentState: Annotation.Root(messages, sessionId, executionId, selectedTools/Skills, knowledgeContext, currentStep)
│       │   ├── nodes.ts      # createAgentNode(加载skills+knowledge→调LLM) + createToolNode(执行工具+记日志) + knowledgeRetrievalNode
│       │   ├── builder.ts    # buildReactGraph(): StateGraph → agent/tools节点 + toolsCondition路由 + 可选knowledge_retrieval节点
│       │   └── runtime.ts    # runAgent(): 入口函数，串联session→execution→graph→response
│       ├── tools/
│       │   ├── currentTime.ts      # tool()封装，返回ISO/local/timestamp
│       │   ├── knowledgeLookup.ts  # tool()封装，调knowledgeService.search
│       │   └── skillCatalog.ts     # tool()封装，调skillRegistry.listSkills
│       ├── routes/
│       │   ├── health.ts      # GET /api/health
│       │   ├── tools.ts       # GET /api/tools, PUT /api/tools/:id
│       │   ├── skills.ts      # GET/POST /api/skills, PUT/DELETE /api/skills/:id
│       │   ├── knowledge.ts   # GET/POST/DELETE /api/knowledge, GET /:id/chunks, POST /search
│       │   ├── sessions.ts    # GET/POST /api/sessions, GET /:sessionId/messages
│       │   ├── executions.ts  # GET /api/executions, GET /:executionId, GET /:executionId/steps
│       │   ├── chat.ts        # POST /api/chat → runAgent()
│       │   └── config.ts      # GET/POST/PUT/DELETE /api/config/providers, PUT /:id/activate, GET/PUT /api/config/langgraph
│       ├── middleware/
│       │   ├── errorHandler.ts  # 全局错误处理
│       │   └── logger.ts       # 请求日志
│       ├── scripts/
│       │   └── dbInit.ts      # 读取sql/init.sql并逐条执行
│       └── utils/
│           └── chunker.ts     # chunkText(text, 500, 50): 按句子边界切块
└── web/
    ├── package.json           # React 18, antd 5, react-router-dom 7, axios
    ├── vite.config.ts         # port:5173, proxy /api → localhost:8787
    ├── index.html
    ├── tsconfig.json
    └── src/
        ├── main.tsx           # ReactDOM.createRoot
        ├── App.tsx            # BrowserRouter + 6个路由
        ├── api/
        │   └── client.ts     # axios封装，所有API调用方法（timeout 120s）
        ├── pages/
        │   ├── Chat.tsx       # 左侧会话列表 + 中间聊天区 + 右侧Tool/Skill选择+执行日志
        │   ├── Config.tsx     # LLM Provider卡片管理 + LangGraph运行时参数表单
        │   ├── Skills.tsx     # 技能表格 + 新增/编辑Modal
        │   ├── Tools.tsx      # 工具表格 + Switch启停
        │   ├── Knowledge.tsx  # 文档表格 + 录入Modal + 分块预览Drawer
        │   └── Architecture.tsx # 架构概要卡片 + 执行记录表格 + 步骤详情Collapse
        ├── components/
        │   ├── Layout.tsx      # AntLayout + Header导航Menu(6项)
        │   ├── ChatMessage.tsx # 用户/助手消息气泡
        │   ├── ToolSelector.tsx  # Checkbox列表
        │   ├── SkillSelector.tsx # Checkbox列表
        │   └── ExecutionLog.tsx  # Collapse面板显示步骤详情
        └── styles/
            └── index.css      # chat-container三栏布局 + 消息气泡样式

```

---

## 二、数据库（10张表）

| 表 | 关键字段 | 索引 |
|----|---------|------|
| agent_sessions | id(UUID), title, created_at, updated_at | PK |
| agent_messages | id, session_id(FK→sessions CASCADE), role(ENUM user/assistant/system/tool), content, tool_calls(JSON) | idx_session, idx_created |
| agent_tools | id, name(UNIQUE), display_name, description, parameters_schema(JSON), enabled, built_in | PK, UNIQUE name |
| agent_skills | id, name(UNIQUE), display_name, description, system_prompt(TEXT), enabled | PK, UNIQUE name |
| knowledge_documents | id, title, source, content(LONGTEXT), status(ENUM pending/chunked/failed), chunk_count | PK |
| knowledge_chunks | id, document_id(FK→documents CASCADE), chunk_index, content(TEXT), char_count | idx_document, FULLTEXT(content) |
| executions | id, session_id(FK→sessions CASCADE), input, status(ENUM pending/running/completed/failed), knowledge_context(JSON), output, error, duration_ms | idx_session, idx_status, idx_created |
| execution_steps | id, execution_id(FK→executions CASCADE), step_index, type(ENUM llm_call/tool_call/knowledge_retrieval), name, input(JSON), output(JSON), duration_ms | idx_execution |
| llm_providers | id, name, api_base_url, api_key, default_model, planner_model, reviewer_model, is_active | PK |
| langgraph_config | id(=1, CHECK), graph_mode, knowledge_top_k(5), max_history_messages(20), auto_knowledge_retrieval, tool_loop_enabled, interrupt_before_tools, stream_mode | PK |

种子数据：3个内置工具 + 4个内置技能 + 默认LangGraph配置 + 默认OpenAI Provider

---

## 三、LangGraph 图 (react_single_agent)

```
START → (knowledge_retrieval?) → agent → toolsCondition → tools → agent → ... → END
```

- `agent_node`: 加载skills构建system prompt → 注入knowledge context → bindTools → invoke LLM → 记录execution_step
- `tool_node`: ToolNode执行 → 记录execution_step
- `knowledgeRetrievalNode`: 可选，autoKnowledgeRetrieval=true时启用

---

## 四、关键技术选型

| 项 | 选择 |
|----|------|
| 后端 | Express + TypeScript + tsx (ESM) |
| ORM | 无，mysql2 + 手写SQL |
| Agent | @langchain/langgraph StateGraph + @langchain/openai ChatOpenAI |
| 工具 | @langchain/core/tools tool() + zod schema |
| 知识检索 | MySQL FULLTEXT + LIKE回退 |
| 前端 | React 18 + Vite + Ant Design 5 + react-router-dom 7 |
| 构建 | tsx(dev) + tsc(build), Vite(前端) |

---

## 五、npm 脚本

| 命令 | 说明 |
|------|------|
| `npm install` | 安装 server + web 依赖 |
| `npm run db:init` | 执行 sql/init.sql 初始化数据库 |
| `npm run dev` | concurrently 启动前后端 |
| `npm run dev:server` | 仅后端 localhost:8787 |
| `npm run dev:web` | 仅前端 localhost:5173 |
| `npm run build` | 编译 server(tsc) + web(vite build) |

---

## 六、待完成事项

1. 用户配置 `server/.env` 的 MYSQL_PASSWORD 和 OPENAI_API_KEY
2. 运行 `npm run db:init` 初始化数据库
3. 运行 `npm run dev` 启动开发环境
4. 验证全链路：新建会话 → 勾选工具/技能 → 聊天 → 查看执行日志
5. 后续扩展：多Agent图、向量检索、MCP工具加载、用户体系

## 七、需求
1、会话页面增加 markdown 展示形式 
2、支持本地skill文件夹内存放已开发的标准SKILL.md技能 
3、留一个hook地址接收webapi信息，并调用skill 以及大模型进行响应
4、缺少调用本地cli命令或者执行脚本权限 
5、执行skill权限 
6、执行mcp权限 你来补充几个技能并跑通

## 八、代码约束
1、把你测试内容写成测试脚本，每次说好了的时候应当先跑完脚本在回复 
2、系统各种组件的版本应当作为写代码的前提开始之前进行阅读避免写出来代码版本不一致 
3、系统步骤留下日志 ，便于排查
4、保持干净的代码结构，各项功能有专门的文件夹，如：test，log等等