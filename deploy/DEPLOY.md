# WAgent 生产部署说明

## 快速部署（Docker Compose）

### 1. 准备环境变量

复制环境变量模板并填入实际值：

```bash
cp deploy/config/env.production .env
# 编辑 .env，填入：OPENAI_API_KEY, JWT_SECRET, MYSQL_PASSWORD, SCADA_API_TOKEN 等
```

### 2. 一键启动

```bash
docker compose up -d
```

这会启动三个容器：
- `wagent-mysql` - MySQL 8.0 数据库
- `wagent-server` - WAgent 后端 + 前端
- `wagent-nginx` - Nginx 反向代理（端口 80）

### 3. 查看状态

```bash
docker compose ps
docker compose logs -f wagent-server
```

### 4. 访问

- Web UI: `http://服务器IP`（通过 Nginx 端口 80）
- 直接访问后端: `http://服务器IP:8787`

## 手动部署（无 Docker）

### 1. 构建

```bash
# 安装依赖
npm install

# 构建前后端
npm run build
```

### 2. 准备生产环境

```bash
# 复制环境变量
cp deploy/config/env.production server/.env.production

# 编辑 server/.env.production，填入实际值
```

### 3. 启动

```bash
cd server
NODE_ENV=production node dist/index.js
```

前端静态文件已集成到后端，直接访问 `http://localhost:8787`。

## 目录结构

```
wagent/
├── skills/           # 技能定义（生产环境必须存在）
├── scripts/          # Python 脚本（生产环境必须存在）
├── server/
│   ├── dist/         # 编译后的 JS 代码
│   └── .env.production
├── web/dist/         # 前端静态文件
└── deploy/
    ├── config/       # 配置文件模板
    └── scripts/      # 数据库初始化脚本
```

## 注意事项

- `skills/` 和 `scripts/` 目录必须存在于生产环境中
- 首次启动会自动创建默认管理员账号
- 如需修改技能或脚本，修改后重启容器即可：`docker compose restart wagent`
- 生产环境建议使用 `.env` 文件管理敏感信息，不要提交到代码库
