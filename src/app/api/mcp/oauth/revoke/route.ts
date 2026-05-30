import { NextResponse } from 'next/server';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { oauthErrorJson } from '@/lib/mcp/oauth/oauth-response';
import { getClient } from '@/lib/mcp/oauth/stores/clients';
import { revokeByHash } from '@/lib/mcp/oauth/stores/tokens';

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const clientId = String(form.get('client_id') ?? '');
  const token = form.get('token');

  const client = await getClient(clientId);
  if (!client) return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_CLIENT, 'Unknown client', 401);

  // RFC 7009: revoke if present; unknown token is still a success.
  if (typeof token === 'string' && token.length > 0) {
    await revokeByHash(token, Date.now());
  }
  return new NextResponse(null, { status: 200, headers: { 'cache-control': 'no-store' } });
}
