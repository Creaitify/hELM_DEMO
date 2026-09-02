/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'export',
  basePath: '/hELM_DEMO',
  assetPrefix: '/hELM_DEMO/',
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  experimental: {
    viewTransition: true,
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
