# WAgent Dockerfile - 生产部署

FROM node:20-alpine AS builder

WORKDIR /app

# 复制根目录 package.json
COPY package*.json ./

# 复制 server 文件
COPY server/package*.json ./server/
RUN cd server && npm install

# 复制 server 源码并构建
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
RUN cd server && npm run build

# 复制 web 文件
COPY web/package*.json ./web/
RUN cd web && npm install

# 复制 web 源码并构建
COPY web/tsconfig.json ./web/
COPY web/vite.config.ts ./web/
COPY web/index.html ./web/
COPY web/public ./web/public
COPY web/src ./web/src
RUN cd web && npm run build

# ---- 生产镜像 ----
FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# 复制生产环境 server
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules

# 复制生产环境 web 静态文件
COPY --from=builder /app/web/dist ./web/dist

# 复制项目根目录依赖
COPY --from=builder /app/package*.json ./

# 复制 skills 和 scripts 目录
COPY skills ./skills
COPY scripts ./scripts

# 复制配置模板
COPY deploy/config/.env.example ./server/.env.production

# 暴露端口
EXPOSE 8787

# 启动命令
WORKDIR /app/server
CMD ["node", "dist/index.js"]
