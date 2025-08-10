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
    minimumCacheTTL: 60 * 60 * 24 * 7, // Cache for 7 days
  },
};

export default nextConfig;
