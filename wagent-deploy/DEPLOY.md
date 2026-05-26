# WAgent 部署指南

## 环境要求

| 组件 | 版本要求 |
|------|---------|
| Node.js | >= 18 (推荐 v22) |
| MySQL | >= 8.0 |
| npm | >= 9 |

## 快速部署步骤

### 1. 解压项目

将 `wagent-deploy.zip` 解压到目标目录，例如：
```bash
unzip wagent-deploy.zip -d wagent
cd wagent
```

### 2. 配置环境变量

```bash
cd server
cp .env.example .env
```

编辑 `.env` 文件，填入以下配置：

```env
PORT=8787
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的MySQL密码
MYSQL_DATABASE=wagent_db

# LLM API 配置（以 Moonshot 为例）
OPENAI_API_KEY=你的API密钥
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=gpt-4.1-mini
```

### 3. 安装依赖

在 **项目根目录** 执行：
```bash
npm run install
```

或分别安装：
```bash
cd server && npm install
cd ../web && npm install
```

### 4. 初始化数据库

确保 MySQL 已启动，然后执行：
```bash
cd server
npm run db:init
```

此命令会：
- 创建数据库表结构
- 初始化默认用户（admin / admin123）
- 同步内置工具和技能

如果数据库已存在且需要升级，额外执行：
```bash
# 在 MySQL 客户端中执行
source ../sql/migration_add_message_source.sql
```

### 5. 启动服务

#### 方式 A: 一键启动（Windows）
```bash
# 在项目根目录
cd ..
start.bat
# 选择选项 [4] 启动前后端开发环境
```

#### 方式 B: 命令行启动
```bash
# 终端 1: 启动后端
cd server
npm run dev

# 终端 2: 启动前端
cd web
npm run dev
```

#### 方式 C: 使用 concurrently（项目根目录）
```bash
npm run dev
```

### 6. 访问应用

- **前端**: http://localhost:5173
- **后端 API**: http://localhost:8787
- **健康检查**: http://localhost:8787/api/health

### 7. 默认登录

- **用户名**: `admin`
- **密码**: `admin123`

登录后进入 **Agent Chat** 页面即可开始对话。

---

## 目录结构说明

```
wagent/
├── server/              # 后端 (Express + LangGraph)
│   ├── src/             # 源代码
│   ├── .env.example     # 环境变量模板
│   └── package.json
├── web/                 # 前端 (React + Vite)
│   ├── src/             # 源代码
│   └── package.json
├── sql/                 # 数据库脚本
│   ├── init.sql         # 初始化表结构
│   ├── add_skill_tags.sql
│   └── migration_add_message_source.sql
├── skills/              # 本地 Skill 定义
├── test/                # 测试脚本
├── start.bat            # Windows 一键启动脚本
└── package.json         # 根目录脚本
```

## 生产环境部署建议

1. **使用 PM2 管理后端进程**
   ```bash
   cd server
   npm run build
   pm2 start dist/index.js --name wagent-server
   ```

2. **前端构建为静态文件**
   ```bash
   cd web
   npm run build
   # 将 dist/ 目录部署到 Nginx / CDN
   ```

3. **配置反向代理**（Nginx 示例）
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5173;
       }

       location /api/ {
           proxy_pass http://localhost:8787;
           proxy_http_version 1.1;
           proxy_set_header Connection '';
       }
   }
   ```

4. **数据库备份**
   - 定期备份 `wagent_db` 数据库
   - 消息表 `agent_messages` 和会话表 `sessions` 是核心数据

## 常见问题

| 问题 | 解决方案 |
|------|---------|
| 前端白屏 | 检查 `web/.env` 是否存在 Vite 代理配置，或检查浏览器控制台报错 |
| 后端启动失败 | 检查 `.env` 中的 MySQL 连接信息是否正确，数据库是否已创建 |
| API Key 错误 | 在 **Config** 页面配置 Provider，或修改 `.env` 后重启后端 |
| 聊天无回复 | 检查后端日志是否有 LLM API 调用错误，确认 API Key 和 Base URL |
| 技能未加载 | 检查 `skills/` 目录是否有 `SKILL.md` 文件，重启后端会自动扫描 |
