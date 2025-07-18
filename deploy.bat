@echo off
chcp 65001 >nul

echo 🚀 开始部署团队分组游戏到 Cloudflare Pages...

REM 检查是否安装了npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 请先安装 Node.js 和 npm
    pause
    exit /b 1
)

REM 检查是否安装了git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 请先安装 Git
    pause
    exit /b 1
)

REM 检查是否在Git仓库中
git rev-parse --git-dir >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 当前目录不是Git仓库
    echo 请先运行: git init ^&^& git add . ^&^& git commit -m "Initial commit"
    pause
    exit /b 1
)

REM 检查是否有未提交的更改
git diff-index --quiet HEAD --
if %errorlevel% neq 0 (
    echo ⚠️  警告: 有未提交的更改
    set /p response="是否要提交这些更改? (y/n): "
    if /i "%response%"=="y" (
        git add .
        git commit -m "Deploy to Cloudflare Pages"
        echo ✅ 更改已提交
    ) else (
        echo ❌ 请先提交更改后再部署
        pause
        exit /b 1
    )
)

REM 安装依赖
echo 📦 安装依赖...
npm install
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)

REM 构建项目
echo 🔨 构建项目...
npm run build
if %errorlevel% neq 0 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo ✅ 构建成功!

REM 推送到远程仓库
echo 📤 推送到远程仓库...
git push
if %errorlevel% neq 0 (
    echo ⚠️  推送失败，请检查远程仓库配置
)

echo.
echo 🎉 部署准备完成!
echo.
echo 📋 下一步操作:
echo 1. 访问 https://dash.cloudflare.com/
echo 2. 进入 Pages 页面
echo 3. 点击 'Create a project'
echo 4. 连接你的 Git 仓库
echo 5. 使用以下构建设置:
echo    - 构建命令: npm run build
echo    - 构建输出目录: .next
echo    - Node.js 版本: 18
echo.
echo 🌐 部署完成后，你的网站将在 https://team-divider.pages.dev 可用
echo.
pause
