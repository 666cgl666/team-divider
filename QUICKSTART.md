# 🚀 快速部署指南

## 📋 5分钟部署到Cloudflare Pages

### 前提条件
- ✅ 代码已推送到Git仓库（GitHub/GitLab/Bitbucket）
- ✅ 有Cloudflare账户

### 🎯 快速部署步骤

#### 1. 运行部署脚本
**Windows用户：**
```cmd
deploy.bat
```

**Mac/Linux用户：**
```bash
chmod +x deploy.sh
./deploy.sh
```

#### 2. 在Cloudflare创建项目
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 点击左侧 **"Pages"**
3. 点击 **"Create a project"**
4. 选择 **"Connect to Git"**

#### 3. 连接仓库
1. 选择你的Git提供商
2. 授权Cloudflare访问
3. 选择 `team-divider` 仓库

#### 4. 配置构建设置
```
项目名称: team-divider
生产分支: main
构建命令: npm run build
构建输出目录: .next
Node.js版本: 18
```

#### 5. 部署
点击 **"Save and Deploy"**

### 🎉 完成！

部署完成后，你的网站将在以下地址可用：
```
https://team-divider.pages.dev
```

### 🔧 自定义域名（可选）

1. 在Pages项目中点击 **"Custom domains"**
2. 点击 **"Set up a custom domain"**
3. 输入你的域名
4. 按照指示配置DNS

### 📱 测试你的应用

访问部署的网站，测试以下功能：
- ✅ 输入玩家名字
- ✅ 加入房间
- ✅ 10人分组
- ✅ 查看分组结果
- ✅ 游戏日志

### 🚨 遇到问题？

查看 [完整部署指南](DEPLOYMENT.md) 获取详细说明和故障排除。

### 🔄 自动部署

连接Git后，每次推送代码都会自动重新部署！
