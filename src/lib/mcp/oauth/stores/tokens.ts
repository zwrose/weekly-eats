// src/lib/mcp/oauth/stores/tokens.ts
import { getMongoClient } from '@/lib/mongodb';
import { generateSecret, sha256Hex } from '@/lib/mcp/oauth/crypto';
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_IDLE_TTL_MS } from '@/lib/mcp/oauth/config';
import type { McpTokenDoc } from '@/lib/mcp/oauth/types';

async function tokens() {
  const client = await getMongoClient();
  return client.db().collection<McpTokenDoc>('mcpTokens');
}

type GrantFields = Pick<McpTokenDoc, 'userId' | 'clientId' | 'resource' | 'scope'>;

/** Mint an access + refresh pair under one grant lineage. Returns RAW secrets. */
export async function mintPair(
  grantId: string,
  fields: GrantFields,
  now: number
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = generateSecret();
  const refreshToken = generateSecret();
  const col = await tokens();
  await col.insertOne({
    ...fields,
    hashedToken: sha256Hex(accessToken),
    tokenType: 'access',
    grantId,
    expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
    revokedAt: null,
    replacedBy: null,
  });
  await col.insertOne({
    ...fields,
    hashedToken: sha256Hex(refreshToken),
    tokenType: 'refresh',
    grantId,
    expiresAt: new Date(now + REFRESH_TOKEN_IDLE_TTL_MS),
    revokedAt: null,
    replacedBy: null,
  });
  return { accessToken, refreshToken };
}

/** Bearer lookup for verifyToken: access-only, non-revoked, non-expired at use. */
export async function findValidAccessToken(
  rawToken: string,
  now: number
): Promise<McpTokenDoc | null> {
  const doc = await (
    await tokens()
  ).findOne({
    hashedToken: sha256Hex(rawToken),
    tokenType: 'access',
    revokedAt: null,
  });
  if (!doc || doc.expiresAt.getTime() <= now) return null;
  return doc;
}

/** Refresh lookup for /token (expiry/revocation handled by the caller). */
export async function findRefreshToken(rawToken: string): Promise<McpTokenDoc | null> {
  return (await tokens()).findOne({ hashedToken: sha256Hex(rawToken), tokenType: 'refresh' });
}

/**
 * Atomic rotation (S3): consume the old refresh (filter requires replacedBy
 * null + revokedAt null) and, only if that succeeded, mint a new pair under the
 * same grant. Returns null when the old token was already rotated/revoked — the
 * caller treats that as reuse and revokes the chain.
 */
export async function rotateRefresh(
  oldRawRefresh: string,
  grantId: string,
  fields: GrantFields,
  now: number
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const newRefresh = generateSecret();
  // The filter also requires a non-expired token (expiresAt > now) so the store
  // self-enforces at-use expiry (arch-002), consistent with findValidAccessToken
  // — a future caller can't mint a fresh pair from an expired-but-unreaped link.
  const claimed = await (
    await tokens()
  ).findOneAndUpdate(
    {
      hashedToken: sha256Hex(oldRawRefresh),
      replacedBy: null,
      revokedAt: null,
      expiresAt: { $gt: new Date(now) },
    },
    { $set: { replacedBy: sha256Hex(newRefresh) } }
  );
  if (!claimed) return null;

  const accessToken = generateSecret();
  const col = await tokens();
  await col.insertOne({
    ...fields,
    hashedToken: sha256Hex(accessToken),
    tokenType: 'access',
    grantId,
    expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
    revokedAt: null,
    replacedBy: null,
  });
  await col.insertOne({
    ...fields,
    hashedToken: sha256Hex(newRefresh),
    tokenType: 'refresh',
    grantId,
    expiresAt: new Date(now + REFRESH_TOKEN_IDLE_TTL_MS),
    revokedAt: null,
    replacedBy: null,
  });
  return { accessToken, refreshToken: newRefresh };
}

/** Revoke every token in a grant lineage (rotated-token replay → kill chain). */
export async function revokeChain(grantId: string, now: number): Promise<void> {
  await (await tokens()).updateMany({ grantId }, { $set: { revokedAt: now } });
}

/** Revoke a single token by raw value (RFC 7009 /revoke, M3). */
export async function revokeByHash(rawToken: string, now: number): Promise<void> {
  await (
    await tokens()
  ).updateOne({ hashedToken: sha256Hex(rawToken) }, { $set: { revokedAt: now } });
}
