-- ============================================================
-- WAgent 数据库初始化脚本
-- 包含全部 10 张表 + 种子数据
--
-- 使用说明：
--   • 新部署：直接执行此脚本即可，无需运行迁移脚本
--   • 旧升级：请先检查 sql/migration_*.sql 中的增量变更，
--     按文件名日期顺序依次执行，再运行此脚本补齐种子数据
-- ============================================================

-- 1. 聊天会话表
CREATE TABLE IF NOT EXISTS agent_sessions (
  id          VARCHAR(36)  PRIMARY KEY,
  title       VARCHAR(255) NOT NULL DEFAULT '新会话',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 聊天消息表
CREATE TABLE IF NOT EXISTS agent_messages (
  id          VARCHAR(36)  PRIMARY KEY,
  session_id  VARCHAR(36)  NOT NULL,
  role        ENUM('user','assistant','system','tool') NOT NULL,
  content     TEXT,
  tool_calls  JSON         DEFAULT NULL COMMENT '工具调用记录',
  source      VARCHAR(50)  DEFAULT 'user' COMMENT '消息来源',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
  INDEX idx_messages_session (session_id),
  INDEX idx_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 工具注册表
CREATE TABLE IF NOT EXISTS agent_tools (
  id                VARCHAR(36)  PRIMARY KEY,
  name              VARCHAR(100) NOT NULL UNIQUE,
  display_name      VARCHAR(200) NOT NULL DEFAULT '',
  description       TEXT         NOT NULL,
  parameters_schema JSON         DEFAULT NULL COMMENT 'JSON Schema 参数描述',
  enabled           TINYINT(1)   NOT NULL DEFAULT 1,
  built_in          TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否内置工具',
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 技能注册表
CREATE TABLE IF NOT EXISTS agent_skills (
  id            VARCHAR(36)  PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  display_name  VARCHAR(200) NOT NULL DEFAULT '',
  description   TEXT         DEFAULT NULL,
  system_prompt TEXT         NOT NULL COMMENT '技能对应的 system prompt',
  file_path     VARCHAR(500) DEFAULT NULL COMMENT '本地 SKILL.md 文件路径',
  tags          JSON         DEFAULT NULL COMMENT '技能标签',
  enabled       TINYINT(1)   NOT NULL DEFAULT 1,
  built_in      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否内置技能',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 知识文档表
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id          VARCHAR(36)  PRIMARY KEY,
  title       VARCHAR(500) NOT NULL,
  source      VARCHAR(500) DEFAULT NULL COMMENT '来源 URL 或文件名',
  content     LONGTEXT     NOT NULL,
  status      ENUM('pending','chunked','failed') NOT NULL DEFAULT 'pending',
  chunk_count INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 知识分块表
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id            VARCHAR(36)  PRIMARY KEY,
  document_id   VARCHAR(36)  NOT NULL,
  chunk_index   INT          NOT NULL DEFAULT 0,
  content       TEXT         NOT NULL,
  char_count    INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  INDEX idx_chunks_document (document_id),
  FULLTEXT INDEX ft_chunks_content (content) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. 执行记录表
CREATE TABLE IF NOT EXISTS executions (
  id                VARCHAR(36)  PRIMARY KEY,
  session_id        VARCHAR(36)  NOT NULL,
  input             TEXT         NOT NULL COMMENT '用户输入',
  status            ENUM('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
  knowledge_context JSON         DEFAULT NULL COMMENT '检索到的知识上下文',
  output            TEXT         DEFAULT NULL COMMENT 'Agent 输出',
  error             TEXT         DEFAULT NULL COMMENT '错误信息',
  duration_ms       INT          DEFAULT NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
  INDEX idx_executions_session (session_id),
  INDEX idx_executions_status (status),
  INDEX idx_executions_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. 执行步骤表
CREATE TABLE IF NOT EXISTS execution_steps (
  id            VARCHAR(36)  PRIMARY KEY,
  execution_id  VARCHAR(36)  NOT NULL,
  step_index    INT          NOT NULL DEFAULT 0,
  type          ENUM('llm_call','tool_call','knowledge_retrieval') NOT NULL,
  name          VARCHAR(200) DEFAULT NULL COMMENT '步骤名称（如工具名）',
  input         JSON         DEFAULT NULL,
  output        JSON         DEFAULT NULL,
  duration_ms   INT          DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE,
  INDEX idx_steps_execution (execution_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. LLM Provider 配置表
CREATE TABLE IF NOT EXISTS llm_providers (
  id              VARCHAR(36)  PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  api_base_url    VARCHAR(500) DEFAULT NULL,
  api_key         VARCHAR(500) DEFAULT NULL,
  default_model   VARCHAR(200) NOT NULL DEFAULT 'gpt-4.1-mini',
  planner_model   VARCHAR(200) DEFAULT NULL,
  reviewer_model  VARCHAR(200) DEFAULT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. LangGraph 运行时配置表（单行）
CREATE TABLE IF NOT EXISTS langgraph_config (
  id                       INT          PRIMARY KEY DEFAULT 1,
  graph_mode               VARCHAR(100) NOT NULL DEFAULT 'react_single_agent',
  knowledge_top_k          INT          NOT NULL DEFAULT 5,
  max_history_messages     INT          NOT NULL DEFAULT 20,
  auto_knowledge_retrieval TINYINT(1)   NOT NULL DEFAULT 0,
  tool_loop_enabled        TINYINT(1)   NOT NULL DEFAULT 1,
  interrupt_before_tools   TINYINT(1)   NOT NULL DEFAULT 0,
  stream_mode              VARCHAR(50)  NOT NULL DEFAULT 'none',
  updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. 用户表
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(36)  PRIMARY KEY,
  username        VARCHAR(100) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  display_name    VARCHAR(200) DEFAULT NULL,
  is_admin        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. 长期记忆表
CREATE TABLE IF NOT EXISTS memories (
  id          VARCHAR(36)  PRIMARY KEY,
  type        ENUM('fact', 'preference', 'summary') NOT NULL DEFAULT 'fact',
  content     TEXT         NOT NULL COMMENT '记忆内容',
  context     TEXT         DEFAULT NULL COMMENT '上下文信息',
  importance  INT          NOT NULL DEFAULT 5 COMMENT '重要程度 1-10',
  source_session_id VARCHAR(36) DEFAULT NULL COMMENT '来源会话ID',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_importance (importance),
  FULLTEXT INDEX ft_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Webhook 端点表
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              VARCHAR(36)  PRIMARY KEY,
  session_id      VARCHAR(36)  NOT NULL,
  webhook_url     VARCHAR(200) NOT NULL COMMENT 'Webhook URL 路径',
  bearer_key      VARCHAR(100) NOT NULL UNIQUE COMMENT 'Bearer Token',
  selected_tools  JSON         DEFAULT NULL COMMENT '选中的工具列表',
  selected_skills JSON         DEFAULT NULL COMMENT '选中的技能列表',
  description     VARCHAR(500) DEFAULT NULL,
  enabled         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  INDEX idx_bearer (bearer_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 种子数据
-- ============================================================

-- 内置工具
INSERT IGNORE INTO agent_tools (id, name, display_name, description, parameters_schema, enabled, built_in) VALUES
  ('11111111-1111-1111-1111-111111111111', 'current_time', '当前时间', '返回当前的日期和时间', '{"type":"object","properties":{}}', 1, 1),
  ('22222222-2222-2222-2222-222222222222', 'knowledge_lookup', '知识检索', '在知识库中搜索相关内容', '{"type":"object","properties":{"query":{"type":"string","description":"搜索关键词"}},"required":["query"]}', 1, 1),
  ('33333333-3333-3333-3333-333333333333', 'skill_catalog', '技能目录', '列出所有可用的技能', '{"type":"object","properties":{}}', 1, 1),
  ('44444444-4444-4444-4444-444444444444', 'exec_command', '执行命令', '执行本地 CLI 命令和脚本，如检查系统信息、操作文件等', '{"type":"object","properties":{"command":{"type":"string","description":"要执行的命令"},"timeout":{"type":"number","description":"超时时间（毫秒）"},"workingDir":{"type":"string","description":"工作目录"}},"required":["command"]}', 1, 1),
  ('55555555-5555-5555-5555-555555555555', 'filesystem_mcp', '文件系统 MCP', '通过 MCP 协议访问本地文件系统', '{"type":"object","mcpType":"filesystem","properties":{"operation":{"type":"string","enum":["read","write","list","exists"],"description":"操作类型"},"path":{"type":"string","description":"文件路径"},"content":{"type":"string","description":"写入内容"}},"required":["operation","path"]}', 1, 1);

-- 内置技能
INSERT IGNORE INTO agent_skills (id, name, display_name, description, system_prompt, enabled, built_in) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'general_assistant', '通用助手', '通用对话助手，适合日常问答',
   '你是一个智能助手，请用中文回答用户的问题。你的回答应该准确、有帮助、简洁。', 1, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'planner', '任务规划', '任务分解与规划专家',
   '你是一个任务规划专家。当用户提出一个复杂任务时，你应该：\n1. 将任务分解为可执行的子步骤\n2. 为每个步骤确定优先级和依赖关系\n3. 给出清晰的执行顺序和时间估计\n4. 识别潜在风险和注意事项', 1, 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'researcher', '信息研究', '信息收集与研究分析专家',
   '你是一个研究分析专家。你应该：\n1. 深入分析用户的问题，识别关键信息需求\n2. 利用可用的工具搜索和验证信息\n3. 综合多个信息源，给出全面的分析\n4. 引用你的信息来源，确保可追溯性', 1, 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'builder', '代码构建', '代码生成与构建专家',
   '你是一个代码构建专家。你应该：\n1. 理解用户的技术需求和上下文\n2. 生成高质量、可维护的代码\n3. 遵循最佳实践和设计模式\n4. 提供必要的注释和使用说明\n5. 考虑错误处理和边界情况', 1, 1);

-- 默认 LangGraph 配置
INSERT IGNORE INTO langgraph_config (id) VALUES (1);

-- 默认 OpenAI Provider（需要用户自行填写 API Key）
INSERT IGNORE INTO llm_providers (id, name, api_base_url, default_model, is_active) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'OpenAI', NULL, 'gpt-4.1-mini', 1);
