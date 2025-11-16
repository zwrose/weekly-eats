import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Prevent CI/production builds from failing on ESLint errors. Lint separately in CI.
    ignoreDuringBuilds: true,
  },
  // Suppress build manifest errors during development
  // These are harmless race conditions when files change
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
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
