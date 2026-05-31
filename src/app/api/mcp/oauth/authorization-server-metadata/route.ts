import { metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { getIssuerUrl, MCP_SCOPE } from '@/lib/mcp/oauth/config';

export function GET(req: Request): Response {
  const issuer = getIssuerUrl(req);
  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    revocation_endpoint: `${issuer}/api/mcp/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [MCP_SCOPE],
    // RFC 9207 — we emit `iss` on every authorization response (R1).
    authorization_response_iss_parameter_supported: true,
  };
  return Response.json(metadata, { headers: { 'cache-control': 'public, max-age=3600' } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
