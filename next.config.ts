import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 全栈模式配置
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // 支持API路由和服务器端功能
  experimental: {
    runtime: 'edge',
  },
};

export default nextConfig;
