@echo off

title WAgent - AI Agent 框架

echo ============================================================
echo   WAgent - AI Agent 框架启动脚本
echo ============================================================
echo.

:MENU
echo  [1] 一键启动（安装依赖 + 初始化DB + 启动前后端）
echo  [2] 仅安装依赖
echo  [3] 仅初始化数据库
echo  [4] 启动前后端开发环境
echo  [5] 仅启动后端
echo  [6] 仅启动前端
echo  [7] 构建生产版本
echo  [0] 退出
echo.
set /p choice=请选择操作 [0-7]:

if "%choice%"=="1" goto FULL
if "%choice%"=="2" goto INSTALL
if "%choice%"=="3" goto DBINIT
if "%choice%"=="4" goto DEV
if "%choice%"=="5" goto SERVER
if "%choice%"=="6" goto WEB
if "%choice%"=="7" goto BUILD
if "%choice%"=="0" goto END
echo 无效选择，请重试。
echo.
goto MENU

:FULL
echo.
echo [1/3] 安装依赖...
echo ------------------------------------------------------------
call npm install
if errorlevel 1 (
    echo [错误] 依赖安装失败！
    pause
    goto MENU
)
echo.
echo [2/3] 初始化数据库...
echo ------------------------------------------------------------
echo 请确认 server\.env 已正确配置 MySQL 连接信息
if not exist "server\.env" (
    echo [提示] 未找到 server\.env，正在从模板复制...
    copy "server\.env.example" "server\.env"
    echo [提示] 请先编辑 server\.env 填入你的 MySQL 密码和 API Key
    echo [提示] 编辑完成后重新运行此脚本
    pause
    goto MENU
)
call npm run db:init
if errorlevel 1 (
    echo [警告] 数据库初始化出现问题，请检查 MySQL 连接配置
    pause
    goto MENU
)
echo.
echo [3/3] 启动开发环境...
echo ------------------------------------------------------------
echo  后端: http://localhost:8787
echo  前端: http://localhost:5173
echo  按 Ctrl+C 停止
echo.
call npm run dev
goto END

:INSTALL
echo.
echo 安装依赖...
cd server && call npm install && cd ../web && call npm install && cd ..
echo.
echo 依赖安装完成！
echo.
pause
goto MENU

:DBINIT
echo.
if not exist "server\.env" (
    echo [提示] 未找到 server\.env，正在从模板复制...
    copy "server\.env.example" "server\.env"
    echo [提示] 请先编辑 server\.env 填入你的 MySQL 密码
    pause
    goto MENU
)
echo 初始化数据库...
call npm run db:init
echo.
echo 数据库初始化完成！
echo.
pause
goto MENU

:DEV
echo.
echo 启动前后端开发环境...
echo  后端: http://localhost:8787
echo  前端: http://localhost:5173
echo  按 Ctrl+C 停止
echo.
call npm run dev
goto END

:SERVER
echo.
echo 启动后端...
echo  地址: http://localhost:8787
echo  按 Ctrl+C 停止
echo.
call npm run dev:server
goto END

:WEB
echo.
echo 启动前端...
echo  地址: http://localhost:5173
echo  按 Ctrl+C 停止
echo.
call npm run dev:web
goto END

:BUILD
echo.
echo 构建生产版本...
call npm run build
echo.
echo 构建完成！
pause
goto MENU

:END
echo.
echo 再见！
