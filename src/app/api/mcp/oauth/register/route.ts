import { NextResponse } from 'next/server';
import { DCR_RATE_LIMIT, DCR_RATE_WINDOW_MS } from '@/lib/mcp/oauth/config';
import { registerClient } from '@/lib/mcp/oauth/stores/clients';
import { consumeRateLimit } from '@/lib/mcp/oauth/stores/rate-limit';
import { getClientIp } from '@/lib/mcp/oauth/request-ip';
import { logError, MCP_OAUTH_ERRORS } from '@/lib/errors';

// RFC 8252: only HTTPS, or loopback http, redirect URIs are accepted (S2).
function isValidRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
    return true;
  }
  return false;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const now = Date.now();
    const ip = getClientIp(req);
    const { allowed } = await consumeRateLimit(
      `register:${ip}`,
      DCR_RATE_LIMIT,
      DCR_RATE_WINDOW_MS,
      now
    );
    if (!allowed) {
      return NextResponse.json(
        { error: MCP_OAUTH_ERRORS.RATE_LIMITED, error_description: 'Too many registrations' },
        { status: 429, headers: { 'cache-control': 'no-store' } }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      client_name?: unknown;
      redirect_uris?: unknown;
    } | null;
    const redirectUris = Array.isArray(body?.redirect_uris) ? body!.redirect_uris : [];
    if (
      redirectUris.length === 0 ||
      !redirectUris.every((u): u is string => typeof u === 'string' && isValidRedirectUri(u))
    ) {
      return NextResponse.json(
        {
          error: MCP_OAUTH_ERRORS.INVALID_REDIRECT_URI,
          error_description: 'redirect_uris must be HTTPS or loopback',
        },
        { status: 400, headers: { 'cache-control': 'no-store' } }
      );
    }
    const clientName = typeof body?.client_name === 'string' ? body.client_name : 'MCP Client';

    const { clientId } = await registerClient({ clientName, redirectUris }, now);

    return NextResponse.json(
      {
        client_id: clientId,
        client_name: clientName,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      },
      { status: 201, headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    logError('McpOAuthRegister', error);
    return NextResponse.json(
      { error: MCP_OAUTH_ERRORS.SERVER_ERROR },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    );
  }
}
