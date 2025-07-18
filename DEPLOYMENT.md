# 🚀 Cloudflare Pages 部署指南

## 📋 部署前准备

### 1. 确保代码已推送到Git仓库
确保你的代码已经推送到GitHub、GitLab或Bitbucket。

### 2. 安装依赖
```bash
npm install
```

## 🌐 方法一：通过Cloudflare Dashboard部署（推荐）

### 1. 登录Cloudflare Dashboard
- 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
- 登录你的账户

### 2. 创建Pages项目
1. 点击左侧菜单的 "Pages"
2. 点击 "Create a project"
3. 选择 "Connect to Git"

### 3. 连接Git仓库
1. 选择你的Git提供商（GitHub/GitLab/Bitbucket）
2. 授权Cloudflare访问你的仓库
3. 选择 `team-divider` 仓库

### 4. 配置构建设置
```
项目名称: team-divider
生产分支: main (或你的主分支名)
构建命令: npm run build
构建输出目录: .next
根目录: / (保持默认)
```

### 5. 环境变量设置（如果需要）
在 "Environment variables" 部分添加：
```
NODE_VERSION=18
```

### 6. 部署
点击 "Save and Deploy" 开始部署。

## 🛠️ 方法二：通过命令行部署

### 1. 安装Wrangler CLI
```bash
npm install -g wrangler
```

### 2. 登录Cloudflare
```bash
wrangler login
```

### 3. 安装项目依赖
```bash
npm install
```

### 4. 构建项目
```bash
npm run build
```

### 5. 部署到Pages
```bash
npx wrangler pages deploy .next --project-name=team-divider
```

## 🔧 高级配置

### 使用Cloudflare Functions（API路由支持）

如果你需要API路由功能，需要使用Next.js on Cloudflare Pages：

1. 安装额外依赖：
```bash
npm install --save-dev @cloudflare/next-on-pages
```

2. 修改构建命令：
```bash
npm run pages:build
```

3. 部署：
```bash
npm run pages:deploy
```

### 自定义域名

1. 在Cloudflare Dashboard中，进入你的Pages项目
2. 点击 "Custom domains" 标签
3. 点击 "Set up a custom domain"
4. 输入你的域名并按照指示配置DNS

## 📝 部署后检查

### 1. 访问你的网站
部署完成后，Cloudflare会提供一个 `.pages.dev` 域名，例如：
```
https://team-divider.pages.dev
```

### 2. 测试功能
- 测试游戏加入功能
- 测试分组功能
- 检查API路由是否正常工作

### 3. 查看部署日志
在Cloudflare Dashboard的Pages项目中，可以查看：
- 部署历史
- 构建日志
- 错误信息

## 🚨 常见问题

### 1. API路由不工作
如果API路由不工作，确保：
- 使用了 `@cloudflare/next-on-pages`
- 构建命令是 `npm run pages:build`
- Next.js配置正确

### 2. 构建失败
检查：
- Node.js版本（推荐18+）
- 依赖是否正确安装
- 构建命令是否正确

### 3. 静态资源404
确保：
- `next.config.ts` 中的 `trailingSlash: true`
- 图片使用 `unoptimized: true`

## 🔄 自动部署

连接Git仓库后，每次推送到主分支都会自动触发部署。

## 📊 监控和分析

Cloudflare Pages提供：
- 访问统计
- 性能监控
- 错误追踪
- 实时日志

## 🎯 下一步

部署成功后，你可以：
1. 设置自定义域名
2. 配置CDN缓存策略
3. 启用Web Analytics
4. 设置安全规则
