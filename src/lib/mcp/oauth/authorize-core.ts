import type { NextResponse } from 'next/server';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { AUTH_CODE_TTL_MS } from '@/lib/mcp/oauth/config';
import { generateSecret } from '@/lib/mcp/oauth/crypto';
import { redirectWithCode, redirectWithError } from '@/lib/mcp/oauth/oauth-response';
import { issueAuthCode } from '@/lib/mcp/oauth/stores/auth-codes';
import { consumeAuthState } from '@/lib/mcp/oauth/stores/auth-states';
import type { McpAuthStateDoc } from '@/lib/mcp/oauth/types';

/**
 * Mint a PKCE-bound auth code for an authenticated, approved, consenting user,
 * and redirect to the client with code + echoed state + iss (R1). Used by both
 * the consent-skip path in /authorize and the Allow path in /authorize/decision.
 *
 * CONSUME-FIRST (security-001): the single-use state nonce is atomically consumed
 * BEFORE the code is minted, and a null result aborts with access_denied. Two
 * concurrent Allow POSTs for the same nonce therefore cannot both mint a code —
 * exactly one wins the consumeAuthState delete; the loser gets null and aborts.
 * (peekAuthState in the consent render is a non-destructive read, so the atomic
 * delete here is the only single-use gate.)
 */
export async function issueCodeAndRedirect(args: {
  nonce: string;
  state: McpAuthStateDoc;
  userId: string;
  issuer: string;
  now: number;
}): Promise<NextResponse> {
  // 1. Atomically claim the nonce. Loser of a concurrent race gets null → abort.
  const consumed = await consumeAuthState(args.nonce, args.now);
  if (!consumed) {
    return redirectWithError({
      redirectUri: args.state.redirectUri,
      error: MCP_OAUTH_ERRORS.ACCESS_DENIED,
      clientState: args.state.clientState,
      issuer: args.issuer,
    });
  }

  // 2. Only the winner mints + stores the code.
  const code = generateSecret();
  await issueAuthCode(
    code,
    {
      clientId: args.state.clientId,
      redirectUri: args.state.redirectUri,
      codeChallenge: args.state.codeChallenge,
      resource: args.state.resource,
      userId: args.userId,
      scope: args.state.scope,
    },
    args.now + AUTH_CODE_TTL_MS
  );
  return redirectWithCode({
    redirectUri: args.state.redirectUri,
    code,
    clientState: args.state.clientState,
    issuer: args.issuer,
  });
}
