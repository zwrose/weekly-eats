// src/lib/mcp/oauth/config.ts
import { getPublicOrigin } from 'mcp-handler';

/** The single OAuth scope granted in v1 (a user's access to their own data). */
export const MCP_SCOPE = 'weekly-eats:rw';

/** Auth codes are single-use and extremely short-lived (seconds, §9 R6). */
export const AUTH_CODE_TTL_MS = 60_000;
/** Access tokens are short-lived; a refresh keeps active users connected. */
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
/** Refresh tokens use a sliding/idle TTL — reset on each rotation (I5/T2). */
export const REFRESH_TOKEN_IDLE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
/** In-flight /authorize state nonce lifetime (I4/A2). */
export const AUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10m

/** DCR per-IP throttle (I6). */
export const DCR_RATE_LIMIT = 10;
export const DCR_RATE_WINDOW_MS = 10 * 60 * 1000; // 10m

/**
 * Stable issuer for this deployment. `getPublicOrigin` respects Vercel's
 * forwarding headers (X-Forwarded-Host/Proto); MCP_ISSUER_URL is an explicit
 * override for fixed-host setups. Issuer + resource derive from the same source
 * so metadata, minted-token audience, and verifyToken stay self-consistent
 * within a single deployment.
 */
export function getIssuerUrl(req: Request): string {
  const override = process.env.MCP_ISSUER_URL;
  if (override) return override;
  return getPublicOrigin(req);
}

/** RFC 8707 resource indicator / token audience: the MCP endpoint URL. */
export function getResourceUrl(req: Request): string {
  return `${getIssuerUrl(req)}/api/mcp`;
}
