#!/bin/bash
# WAgent 生产部署脚本
# 用法: ./deploy.sh [build|start|stop|restart|logs|status]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env"

check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        echo "❌ 环境变量文件不存在: $ENV_FILE"
        echo "请复制并编辑: cp deploy/config/.env.example .env"
        exit 1
    fi
    echo "✅ 环境变量文件已就绪"
}

case "${1:-build}" in
    build)
        echo " 构建前后端..."
        npm run build
        echo "✅ 构建完成"
        ;;
    start)
        check_env
        echo "🚀 启动服务..."
        docker compose up -d
        echo "✅ 服务已启动"
        docker compose ps
        ;;
    stop)
        echo "🛑 停止服务..."
        docker compose down
        echo "✅ 服务已停止"
        ;;
    restart)
        echo "🔄 重启服务..."
        docker compose restart
        echo "✅ 服务已重启"
        ;;
    logs)
        docker compose logs -f "${2:-wagent-server}"
        ;;
    status)
        docker compose ps
        ;;
    init)
        check_env
        echo "📋 初始化环境变量..."
        cp deploy/config/.env.example "$ENV_FILE"
        echo "✅ 已创建 .env 文件，请编辑后填入实际值"
        echo ""
        echo "需要配置的关键变量:"
        echo "  - MYSQL_PASSWORD: 数据库密码"
        echo "  - OPENAI_API_KEY: Moonshot API Key"
        echo "  - JWT_SECRET: 随机字符串"
        ;;
    *)
        echo "WAgent 部署工具"
        echo "用法: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  init     - 初始化环境变量文件"
        echo "  build    - 构建前后端 (默认)"
        echo "  start    - 启动 Docker 服务"
        echo "  stop     - 停止 Docker 服务"
        echo "  restart  - 重启 Docker 服务"
        echo "  logs     - 查看日志"
        echo "  status   - 查看服务状态"
        ;;
esac
