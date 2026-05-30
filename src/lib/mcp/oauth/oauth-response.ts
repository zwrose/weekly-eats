// src/lib/mcp/oauth/oauth-response.ts
import { NextResponse } from 'next/server';
import type { McpOAuthError } from '@/lib/errors';

/** OAuth error as a JSON body (token/register endpoints). Always no-store. */
export function oauthErrorJson(
  error: McpOAuthError,
  description: string,
  status: number
): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { 'cache-control': 'no-store' } }
  );
}

function buildRedirect(redirectUri: string, params: Record<string, string | null>): NextResponse {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url.toString(), 302);
}

/** Error redirect back to the client. Emits `iss` on the error path too (R1). */
export function redirectWithError(args: {
  redirectUri: string;
  error: McpOAuthError;
  clientState: string | null;
  issuer: string;
  description?: string;
}): NextResponse {
  return buildRedirect(args.redirectUri, {
    error: args.error,
    error_description: args.description ?? null,
    state: args.clientState,
    iss: args.issuer,
  });
}

/** Success redirect carrying the auth code, echoed client state, and `iss` (R1). */
export function redirectWithCode(args: {
  redirectUri: string;
  code: string;
  clientState: string | null;
  issuer: string;
}): NextResponse {
  return buildRedirect(args.redirectUri, {
    code: args.code,
    state: args.clientState,
    iss: args.issuer,
  });
}
