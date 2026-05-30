// src/lib/mcp/oauth/stores/__tests__/tokens.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';
import { sha256Hex } from '../../crypto';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import {
  findRefreshToken,
  findValidAccessToken,
  mintPair,
  revokeByHash,
  revokeChain,
  rotateRefresh,
} from '../tokens';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

const fields = {
  userId: 'u1',
  clientId: 'c1',
  resource: 'https://app.test/api/mcp',
  scope: 'weekly-eats:rw',
};
const NOW = 1_000_000;

describe('tokens store', () => {
  it('mintPair issues an access + refresh under one grantId', async () => {
    const { accessToken, refreshToken } = await mintPair('grant-1', fields, NOW);
    const acc = await findValidAccessToken(accessToken, NOW);
    expect(acc?.userId).toBe('u1');
    expect(acc?.tokenType).toBe('access');
    const ref = await findRefreshToken(refreshToken);
    expect(ref?.tokenType).toBe('refresh');
    expect(ref?.grantId).toBe('grant-1');
  });

  it('a refresh token presented as a bearer does NOT match (arch-001)', async () => {
    const { refreshToken } = await mintPair('grant-1', fields, NOW);
    expect(await findValidAccessToken(refreshToken, NOW)).toBeNull();
  });

  it('submitting sha256Hex(T) as the bearer does NOT authenticate (T1 negative)', async () => {
    // Proves the QUERY-side hash step is live: the store hashes the incoming
    // bearer, so a pre-hashed value hashes again and cannot match the stored hash.
    const { accessToken } = await mintPair('grant-1', fields, NOW);
    expect(await findValidAccessToken(sha256Hex(accessToken), NOW)).toBeNull();
  });

  it('an expired access token is rejected at use (R6)', async () => {
    const { accessToken } = await mintPair('grant-1', fields, NOW);
    expect(await findValidAccessToken(accessToken, NOW + 60 * 60 * 1000 + 1)).toBeNull();
  });

  it('a revoked access token is rejected (M3/T3-store)', async () => {
    const { accessToken } = await mintPair('grant-1', fields, NOW);
    await revokeByHash(accessToken, NOW + 1);
    expect(await findValidAccessToken(accessToken, NOW + 2)).toBeNull();
  });

  // Note (test-003): this exercises SEQUENTIAL reuse detection. True concurrent
  // rotation (two simultaneous findOneAndUpdate calls before either completes) is
  // untestable with a single-threaded fake DB. The S3 atomicity guarantee comes
  // from MongoDB's server-side atomic findOneAndUpdate: the filter
  // {hashedToken, replacedBy:null, revokedAt:null} lets exactly one concurrent
  // caller match and set replacedBy; all others find it set and get null. This
  // sequential test is the accepted unit-level substitute for the concurrent case.
  it('rotateRefresh succeeds once; the old refresh cannot rotate again (S3)', async () => {
    const { refreshToken } = await mintPair('grant-1', fields, NOW);
    const rotated = await rotateRefresh(refreshToken, 'grant-1', fields, NOW + 10);
    expect(rotated).not.toBeNull();
    // second rotation of the SAME old token fails (replacedBy now set)
    expect(await rotateRefresh(refreshToken, 'grant-1', fields, NOW + 20)).toBeNull();
  });

  it('the new refresh from rotation gets a fresh sliding expiry (T2)', async () => {
    const { refreshToken } = await mintPair('grant-1', fields, NOW);
    const rotated = await rotateRefresh(refreshToken, 'grant-1', fields, NOW + 10);
    const newRef = await findRefreshToken(rotated!.refreshToken);
    expect(newRef?.expiresAt).toBe(NOW + 10 + 30 * 24 * 60 * 60 * 1000);
  });

  it('revokeChain revokes every token sharing the grant', async () => {
    const { accessToken, refreshToken } = await mintPair('grant-1', fields, NOW);
    await revokeChain('grant-1', NOW + 5);
    expect(await findValidAccessToken(accessToken, NOW + 6)).toBeNull();
    expect((await findRefreshToken(refreshToken))?.revokedAt).toBe(NOW + 5);
  });

  it('mintPair stores only hashes, never the raw secrets (M2/S1)', async () => {
    const { accessToken, refreshToken } = await mintPair('grant-1', fields, NOW);
    const docs = fake.store.get('mcpTokens')!;
    const blob = JSON.stringify(docs);
    expect(blob).not.toContain(accessToken);
    expect(blob).not.toContain(refreshToken);
    expect(docs.some((d) => d.hashedToken === sha256Hex(accessToken))).toBe(true);
  });
});
