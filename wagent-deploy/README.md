# WAgent - AI Agent 框架

> 基于 LangGraph + React + Express 的智能代理框架

## 📁 项目结构

```
wagent/
├── logs/                    # 测试和运行日志
│   └── test-*.log
├── test/                    # 测试脚本
│   └── wagent-test-suite.js
├── skills/                  # 本地 Skill 文件夹
│   ├── local/              # 独立 Skill 文件
│   │   ├── code_reviewer.md
│   │   └── devops_expert.md
│   └── */                  # 子文件夹 Skill (SKILL.md)
├── server/                  # 后端服务
│   ├── src/
│   │   ├── graph/          # LangGraph 工作流
│   │   ├── models/         # 数据库模型
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── tools/          # 工具实现
│   │   └── index.ts        # 入口
│   └── package.json
├── web/                     # 前端应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── pages/          # 页面
│   │   └── styles/         # 样式
│   └── package.json
└── sql/
    └── init.sql            # 数据库初始化
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
# 编辑 server/.env 填入 MySQL 密码和 OpenAI API Key
```

### 3. 初始化数据库

```bash
npm run db:init
```

### 4. 启动服务

```bash
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:8787

## 🧪 测试

### 运行测试脚本

```bash
node test/wagent-test-suite.js
```

### 查看日志

```bash
ls logs/
cat logs/test-*.log
```

## 📦 系统组件版本

| 组件 | 版本 |
|------|------|
| Node.js | v22.22.0 |
| React | 18.3.1 |
| Ant Design | 5.29.3 |
| Vite | 6.4.2 |
| Express | 4.22.1 |
| LangChain Core | 0.3.80 |
| MySQL2 | 3.20.0 |

## ✨ 主要功能

### 1. 多文件夹 Skill 扫描
- 自动扫描 `skills/` 下的所有子文件夹
- 读取 `SKILL.md` 文件并注册
- 支持 `skills/local/*.md` 独立文件

### 2. Webhook 配置
- Config 页面配置 Webhook 地址
- Skill 级别的 Webhook 映射

### 3. 会话标题自动生成
- 根据第一条消息自动生成标题
- 使用 LLM 或降级方案

### 4. Markdown 渲染
- 聊天消息支持 Markdown
- 代码高亮、表格、列表等

## 📄 Skill 文件格式

```markdown
---
name: skill_name
description: Skill 描述
---

# Skill 标题

## 系统提示词
这里是发送给 AI 的系统提示词...
```

## 📝 日志记录

- 服务日志: 控制台输出
- 测试日志: `logs/test-*.log`
