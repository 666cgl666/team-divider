import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开发环境支持API路由，生产环境可选择静态导出或服务器模式
  ...(process.env.EXPORT_MODE === 'static' ? {
    output: 'export',
    distDir: 'out',
  } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
