import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { getIssuerUrl } from '@/lib/mcp/oauth/config';
import { oauthErrorJson, redirectWithError } from '@/lib/mcp/oauth/oauth-response';
import { consumeAuthState, peekAuthState } from '@/lib/mcp/oauth/stores/auth-states';
import { grantConsent } from '@/lib/mcp/oauth/stores/consents';
import { lookupApproval } from '@/lib/mcp/oauth/approval';
import { issueCodeAndRedirect } from '@/lib/mcp/oauth/authorize-core';

export async function POST(req: Request): Promise<Response> {
  const now = Date.now();
  const issuer = getIssuerUrl(req);
  const form = await req.formData();
  const nonce = String(form.get('mcp_auth') ?? '');
  const decision = String(form.get('decision') ?? '');

  const state = await peekAuthState(nonce, now);
  if (!state) {
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_REQUEST, 'Authorization request expired', 400);
  }

  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL('/', issuer);
    loginUrl.searchParams.set('callbackUrl', `/api/mcp/oauth/authorize?mcp_auth=${nonce}`);
    return NextResponse.redirect(loginUrl.toString(), 302);
  }
  const userId = session.user.id;

  const denied = () => {
    return redirectWithError({
      redirectUri: state.redirectUri,
      error: MCP_OAUTH_ERRORS.ACCESS_DENIED,
      clientState: state.clientState,
      issuer,
    });
  };

  // Re-run the approval gate at the issuance boundary (defense-in-depth).
  const approval = await lookupApproval(userId);
  if (!approval || (!approval.isApproved && !approval.isAdmin)) {
    await consumeAuthState(nonce, now);
    return denied();
  }

  if (decision !== 'allow') {
    await consumeAuthState(nonce, now);
    return denied();
  }

  await grantConsent(userId, state.clientId, state.scope, now);
  return issueCodeAndRedirect({ nonce, state, userId, issuer, now });
}
