import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getResourceUrl } from '@/lib/mcp/oauth/config';
import { findValidAccessToken } from '@/lib/mcp/oauth/stores/tokens';
import { lookupApproval } from '@/lib/mcp/oauth/approval';

/**
 * MCP auth gate for withMcpAuth (§6.4). Owns ALL security logic — the adapter
 * only checks expiry+scope after we return (R5). Steps:
 *  1. hash-lookup an access-only, non-revoked, non-expired-at-use token (T1/R6/M3, arch-001),
 *  2. verify the token's bound resource is this server (R3 audience binding),
 *  3. live `users` approval lookup (M1) — revoked approval applies immediately.
 * Any failure returns undefined → withMcpAuth issues 401 + WWW-Authenticate (R4).
 */
export async function verifyToken(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const now = Date.now();
  const tokenDoc = await findValidAccessToken(bearerToken, now);
  if (!tokenDoc) return undefined;

  if (tokenDoc.resource !== getResourceUrl(req)) return undefined; // R3

  const approval = await lookupApproval(tokenDoc.userId); // M1
  if (!approval || (!approval.isApproved && !approval.isAdmin)) return undefined;

  return {
    token: bearerToken,
    clientId: tokenDoc.clientId,
    scopes: [tokenDoc.scope],
    extra: {
      userId: tokenDoc.userId,
      isApproved: approval.isApproved,
      isAdmin: approval.isAdmin,
    },
  };
}
