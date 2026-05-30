import { NextResponse } from 'next/server';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { ACCESS_TOKEN_TTL_MS, getResourceUrl, MCP_SCOPE } from '@/lib/mcp/oauth/config';
import { pkceS256Matches } from '@/lib/mcp/oauth/crypto';
import { oauthErrorJson } from '@/lib/mcp/oauth/oauth-response';
import { getClient } from '@/lib/mcp/oauth/stores/clients';
import { consumeAuthCode, grantIdForCode } from '@/lib/mcp/oauth/stores/auth-codes';
import {
  findRefreshToken,
  mintPair,
  revokeChain,
  rotateRefresh,
} from '@/lib/mcp/oauth/stores/tokens';
import { lookupApproval } from '@/lib/mcp/oauth/approval';

function tokenJson(pair: { accessToken: string; refreshToken: string }, scope: string): Response {
  return NextResponse.json(
    {
      access_token: pair.accessToken,
      refresh_token: pair.refreshToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      scope,
    },
    { status: 200, headers: { 'cache-control': 'no-store' } }
  );
}

export async function POST(req: Request): Promise<Response> {
  const now = Date.now();
  const form = await req.formData();
  const grantType = String(form.get('grant_type') ?? '');
  const clientId = String(form.get('client_id') ?? '');

  // Client auth (public client; PKCE substitutes for a secret). T4.
  const client = await getClient(clientId);
  if (!client) return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_CLIENT, 'Unknown client', 401);

  if (grantType === 'authorization_code') {
    const rawCode = String(form.get('code') ?? '');
    const redirectUri = String(form.get('redirect_uri') ?? '');
    const codeVerifier = form.get('code_verifier');

    const codeDoc = await consumeAuthCode(rawCode, now);
    if (!codeDoc) {
      // Replay of a consumed code → revoke tokens minted from it (MA).
      await revokeChain(grantIdForCode(rawCode), now);
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Invalid or expired code', 400);
    }
    // Cross-client / cross-redirect injection (sec-005).
    if (codeDoc.clientId !== clientId || codeDoc.redirectUri !== redirectUri) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Code/client/redirect mismatch', 400);
    }
    // PKCE — verifier required against the stored challenge (R2 downgrade reject).
    if (typeof codeVerifier !== 'string' || !pkceS256Matches(codeVerifier, codeDoc.codeChallenge)) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'PKCE verification failed', 400);
    }
    // Audience (RFC 8707) — minted token is bound to this server.
    if (codeDoc.resource !== getResourceUrl(req)) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Resource mismatch', 400);
    }

    const pair = await mintPair(
      grantIdForCode(rawCode),
      { userId: codeDoc.userId, clientId, resource: codeDoc.resource, scope: codeDoc.scope },
      now
    );
    return tokenJson(pair, codeDoc.scope);
  }

  if (grantType === 'refresh_token') {
    const rawRefresh = String(form.get('refresh_token') ?? '');
    const doc = await findRefreshToken(rawRefresh);
    if (!doc) return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Unknown refresh token', 400);
    if (doc.clientId !== clientId) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Client mismatch', 400);
    }
    if (doc.expiresAt <= now) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Refresh token expired', 400);
    }
    if (doc.revokedAt !== null) {
      await revokeChain(doc.grantId, now);
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Refresh token revoked', 400);
    }

    // Live approval re-check on every refresh (I5).
    const approval = await lookupApproval(doc.userId);
    if (!approval || (!approval.isApproved && !approval.isAdmin)) {
      await revokeChain(doc.grantId, now);
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'User not approved', 400);
    }

    // Atomic rotation w/ reuse detection (S3). Null → already rotated → kill chain.
    const rotated = await rotateRefresh(
      rawRefresh,
      doc.grantId,
      { userId: doc.userId, clientId, resource: doc.resource, scope: doc.scope },
      now
    );
    if (!rotated) {
      await revokeChain(doc.grantId, now);
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Refresh token reuse detected', 400);
    }
    return tokenJson(rotated, doc.scope ?? MCP_SCOPE);
  }

  return oauthErrorJson(MCP_OAUTH_ERRORS.UNSUPPORTED_GRANT_TYPE, 'Unsupported grant_type', 400);
}
