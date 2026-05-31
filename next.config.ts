import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
  // Bundle the skills source tree into the MCP function so the skill
  // registry's fs reads resolve in Vercel serverless (Phase 3).
  outputFileTracingIncludes: {
    '/api/[transport]': ['./skills/**/*'],
  },
  async rewrites() {
    return [
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/mcp/oauth/protected-resource-metadata',
      },
      {
        source: '/.well-known/oauth-protected-resource/:path*',
        destination: '/api/mcp/oauth/protected-resource-metadata',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/mcp/oauth/authorization-server-metadata',
      },
      {
        source: '/.well-known/oauth-authorization-server/:path*',
        destination: '/api/mcp/oauth/authorization-server-metadata',
      },
    ];
  },
};

export default nextConfig;
