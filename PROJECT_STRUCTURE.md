# WAgent 项目结构

> 整理时间：2026-05-14

## 目录结构

```
water LCF/                              # 工作区根目录
├── .claude/                            # Claude 配置
├── .qoder/                             # Qoder 配置
├── .vscode/                            # VS Code 配置
├── AGENTS.md                           # AI 行为规范
│
├── projects/                           # 项目目录
│   ├── wagent/                         # WAgent 主项目
│   │   ├── server/                     # 后端（Express + LangGraph）
│   │   │   ├── src/
│   │   │   │   ├── graph/             # LangGraph 工作流
│   │   │   │   ├── routes/            # API 路由
│   │   │   │   ├── services/          # 业务逻辑
│   │   │   │   ├── models/            # 数据模型
│   │   │   │   ├── tools/             # 工具实现
│   │   │   │   └── middleware/        # 中间件
│   │   │   ├── tests/                 # 后端测试
│   │   │   └── package.json
│   │   │
│   │   ├── web/                        # 前端（React + Vite）
│   │   │   ├── src/
│   │   │   │   ├── pages/             # 页面组件
│   │   │   │   ├── components/        # 可复用组件
│   │   │   │   ├── api/               # API 调用
│   │   │   │   └── context/           # 状态管理
│   │   │   └── package.json
│   │   │
│   │   ├── skills/                     # 技能定义
│   │   │   ├── template/              # 技能模板 ⭐ 新增
│   │   │   ├── local/                 # 独立技能文件
│   │   │   └── */                     # 子目录技能
│   │   │
│   │   ├── sql/                        # 数据库脚本
│   │   │   └── init.sql
│   │   │
│   │   ├── test/                       # 测试脚本
│   │   ├── docs/                       # 项目文档
│   │   ├── deploy/                     # 部署配置
│   │   ├── requirement/                # 需求文档
│   │   │
│   │   ├── README.md                   # 项目说明
│   │   ├── DEFECTS.md                  # 缺陷清单
│   │   ├── DEPLOY.md                   # 部署指南
│   │   ├── IMPLEMENTATION.md           # 实现文档
│   │   ├── Dockerfile                  # Docker 配置
│   │   ├── docker-compose.yml
│   │   ├── package.json
│   │   └── .gitignore                  # Git 忽略规则 ⭐ 新增
│   │
│   └── rl-streaming/                   # 流式强化学习项目
│       └── ...
│
├── papers/                             # 论文相关
│   └── wc-multi-agent/
│       ├── WC-Multi-Agent data/        # 实验数据
│       ├── script.md
│       ├── 论文技术细节.md
│       └── 论文框架.md
│
└── docs/                               # 文档中心
    └── writing/                        # 写作相关
        └── nature-skills/
```

## 整理内容

### ✅ 已完成

1. **完善 .gitignore** - 排除 node_modules、logs、构建产物等
2. **清理调试文件** - 删除 debug.log、wagent-deploy.zip 等
3. **整理根目录** - 创建 projects/、papers/、docs/ 分类
4. **统一文档结构** - 按类型归类文档
5. **创建 skill 模板** - skills/template/ 提供标准化模板

### 📝 改进建议

#### P1 - 短期优化
- [ ] 统一使用 pnpm 替代 npm（更快的依赖安装）
- [ ] 添加 CI/CD 配置（.github/workflows/）
- [ ] 补充 API 文档（docs/api/）

#### P2 - 长期改进
- [ ] 引入数据库迁移工具（Flyway/Liquibase）
- [ ] 添加 E2E 测试框架
- [ ] 创建开发者入门指南

## 快速开始

```bash
# 进入项目目录
cd projects/wagent

# 安装依赖
npm install

# 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env 填入 MySQL 密码和 OpenAI API Key

# 初始化数据库
npm run db:init

# 启动开发服务
npm run dev

# 访问
# 前端: http://localhost:5173
# 后端: http://localhost:8787
```

## 创建新技能

```bash
# 复制模板
cp -r skills/template skills/your-skill-name

# 编辑 SKILL.md
vim skills/your-skill-name/SKILL.md

# 重启服务或刷新 Web 界面
```
