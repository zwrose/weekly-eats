import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Prevent CI/production builds from failing on ESLint errors. Lint separately in CI.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30, // Cache for 30 days to reduce 429 errors
    // Add device sizes for better optimization
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
