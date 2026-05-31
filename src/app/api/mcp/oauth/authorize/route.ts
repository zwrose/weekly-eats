// src/app/api/mcp/oauth/authorize/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { AUTH_STATE_TTL_MS, getIssuerUrl, getResourceUrl, MCP_SCOPE } from '@/lib/mcp/oauth/config';
import { oauthErrorJson, redirectWithError } from '@/lib/mcp/oauth/oauth-response';
import { getClient, touchClient } from '@/lib/mcp/oauth/stores/clients';
import {
  consumeAuthState,
  createAuthState,
  peekAuthState,
} from '@/lib/mcp/oauth/stores/auth-states';
import { hasConsent } from '@/lib/mcp/oauth/stores/consents';
import { lookupApproval } from '@/lib/mcp/oauth/approval';
import { issueCodeAndRedirect } from '@/lib/mcp/oauth/authorize-core';
import type { McpAuthStateDoc } from '@/lib/mcp/oauth/types';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.searchParams;
  const now = Date.now();
  const issuer = getIssuerUrl(req);
  const nonce = p.get('mcp_auth');

  if (nonce) return postLogin(req, nonce, issuer, now);
  return initial(req, p, issuer, now);
}

async function initial(
  req: Request,
  p: URLSearchParams,
  issuer: string,
  now: number
): Promise<Response> {
  const clientId = p.get('client_id') ?? '';
  const redirectUri = p.get('redirect_uri') ?? '';
  const clientState = p.get('state');

  // 1. Validate client + redirect_uri BEFORE trusting redirect_uri (no redirect on failure).
  const client = await getClient(clientId);
  if (!client) {
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_CLIENT, 'Unknown client_id', 400);
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_REQUEST, 'redirect_uri not registered', 400);
  }

  // Refresh lastUsedAt so the 90d TTL reaper (I6) doesn't prune active clients.
  await touchClient(clientId, now);

  // 2. redirect_uri is trusted → remaining failures redirect back with iss (R1).
  const fail = (description: string) =>
    redirectWithError({
      redirectUri,
      error: MCP_OAUTH_ERRORS.INVALID_REQUEST,
      clientState,
      issuer,
      description,
    });

  if (p.get('response_type') !== 'code') {
    return redirectWithError({
      redirectUri,
      error: MCP_OAUTH_ERRORS.UNSUPPORTED_RESPONSE_TYPE,
      clientState,
      issuer,
    });
  }
  const codeChallenge = p.get('code_challenge');
  if (!codeChallenge) return fail('code_challenge required');
  if (p.get('code_challenge_method') !== 'S256') return fail('code_challenge_method must be S256');

  const scope = p.get('scope') ?? MCP_SCOPE;
  if (scope !== MCP_SCOPE) {
    return redirectWithError({
      redirectUri,
      error: MCP_OAUTH_ERRORS.INVALID_SCOPE,
      clientState,
      issuer,
    });
  }
  // Resource indicator (RFC 8707): default to this server; reject a foreign one.
  const resource = p.get('resource') ?? getResourceUrl(req);
  if (resource !== getResourceUrl(req)) return fail('resource indicator mismatch');

  // 3. Persist the in-flight request behind a single-use nonce (I4/A2).
  const { nonce, doc } = await createAuthState(
    { clientId, redirectUri, codeChallenge, resource, scope, clientState },
    now,
    now + AUTH_STATE_TTL_MS
  );

  // 4. Need an authenticated human. Send them to the bespoke connector
  // sign-in screen (it reuses the app's Google sign-in under the hood).
  const session = await auth();
  if (!session?.user?.id) {
    const connectUrl = new URL('/mcp/connect', getIssuerUrl(req));
    connectUrl.searchParams.set('mcp_auth', nonce);
    return NextResponse.redirect(connectUrl.toString(), 302);
  }
  // Already authenticated: use the doc we just inserted — no read-back (arch-004).
  return postLoginWithState(req, nonce, doc, session.user.id, issuer, now);
}

async function postLogin(
  req: Request,
  nonce: string,
  issuer: string,
  now: number
): Promise<Response> {
  const state = await peekAuthState(nonce, now);
  if (!state) {
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_REQUEST, 'Authorization request expired', 400);
  }
  const session = await auth();
  if (!session?.user?.id) {
    const connectUrl = new URL('/mcp/connect', getIssuerUrl(req));
    connectUrl.searchParams.set('mcp_auth', nonce);
    return NextResponse.redirect(connectUrl.toString(), 302);
  }
  return postLoginWithState(req, nonce, state, session.user.id, issuer, now);
}

async function postLoginWithState(
  _req: Request,
  nonce: string,
  state: McpAuthStateDoc,
  userId: string,
  issuer: string,
  now: number
): Promise<Response> {
  // Approval gate BEFORE any code issuance — including the consent-skip path (L5-S1/L6).
  const approval = await lookupApproval(userId);
  if (!approval || (!approval.isApproved && !approval.isAdmin)) {
    // Consume the nonce on denial too (single-use; mirrors /authorize/decision).
    await consumeAuthState(nonce, now);
    return redirectWithError({
      redirectUri: state.redirectUri,
      error: MCP_OAUTH_ERRORS.ACCESS_DENIED,
      clientState: state.clientState,
      issuer,
    });
  }

  // Prior consent for this exact (user, client, scope) → skip the screen (CS1).
  if (await hasConsent(userId, state.clientId, state.scope)) {
    return issueCodeAndRedirect({ nonce, state, userId, issuer, now });
  }
  // Otherwise show the consent screen.
  const consentUrl = new URL('/mcp/consent', issuer);
  consentUrl.searchParams.set('mcp_auth', nonce);
  return NextResponse.redirect(consentUrl.toString(), 302);
}
