#!/bin/bash

# 团队分组游戏 - Cloudflare Pages 部署脚本

echo "🚀 开始部署团队分组游戏到 Cloudflare Pages..."

# 检查是否安装了必要的工具
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 请先安装 Node.js 和 npm"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ 错误: 请先安装 Git"
    exit 1
fi

# 检查是否在Git仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 错误: 当前目录不是Git仓库"
    echo "请先运行: git init && git add . && git commit -m 'Initial commit'"
    exit 1
fi

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  警告: 有未提交的更改"
    echo "是否要提交这些更改? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        git add .
        git commit -m "Deploy to Cloudflare Pages"
        echo "✅ 更改已提交"
    else
        echo "❌ 请先提交更改后再部署"
        exit 1
    fi
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建项目
echo "🔨 构建项目..."
npm run build

# 检查构建是否成功
if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo "✅ 构建成功!"

# 推送到远程仓库
echo "📤 推送到远程仓库..."
git push

echo "🎉 部署准备完成!"
echo ""
echo "📋 下一步操作:"
echo "1. 访问 https://dash.cloudflare.com/"
echo "2. 进入 Pages 页面"
echo "3. 点击 'Create a project'"
echo "4. 连接你的 Git 仓库"
echo "5. 使用以下构建设置:"
echo "   - 构建命令: npm run build"
echo "   - 构建输出目录: .next"
echo "   - Node.js 版本: 18"
echo ""
echo "🌐 部署完成后，你的网站将在 https://team-divider.pages.dev 可用"
