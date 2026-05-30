import { timingSafeEqual } from 'node:crypto';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

/**
 * Phase 1 MCP auth: a single static dev token, enabled ONLY when
 * MCP_DEV_TOKEN and MCP_DEV_USER_ID are set AND NODE_ENV !== 'production'
 * (C1, spec §11). It is never wired into any deployed environment; Phase 2
 * replaces this entirely with the OAuth-minted token verifier (§6.4).
 *
 * Env is read on every call (not at module load) so config/test changes take
 * effect without a reimport.
 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function verifyToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const devToken = process.env.MCP_DEV_TOKEN;
  const devUserId = process.env.MCP_DEV_USER_ID;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction || !devToken || !devUserId) return undefined;
  if (!bearerToken || !safeEqual(bearerToken, devToken)) return undefined;

  return {
    token: bearerToken,
    clientId: 'mcp-dev',
    scopes: ['weekly-eats:rw'],
    extra: { userId: devUserId, isApproved: true, isAdmin: false },
  };
}
