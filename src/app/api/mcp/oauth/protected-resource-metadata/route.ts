// src/app/api/mcp/oauth/protected-resource-metadata/route.ts
import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { getIssuerUrl, getResourceUrl, MCP_SCOPE } from '@/lib/mcp/oauth/config';

export function GET(req: Request): Response {
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [getIssuerUrl(req)],
    resourceUrl: getResourceUrl(req),
    additionalMetadata: { scopes_supported: [MCP_SCOPE] },
  });
  return Response.json(metadata, { headers: { 'cache-control': 'public, max-age=3600' } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
