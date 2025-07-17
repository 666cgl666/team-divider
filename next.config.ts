import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages配置
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
