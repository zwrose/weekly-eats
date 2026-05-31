// src/lib/__tests__/database-indexes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createIndex = vi.fn().mockResolvedValue('ok');
const dropIndexes = vi.fn().mockResolvedValue('ok');
const collection = vi.fn(() => ({ createIndex, dropIndexes }));

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({ db: () => ({ collection }) })),
}));

import { createDatabaseIndexes, dropAllIndexes } from '../database-indexes';

const MCP = [
  'mcpClients',
  'mcpAuthCodes',
  'mcpTokens',
  'mcpAuthStates',
  'mcpConsents',
  'mcpRateLimits',
];

describe('database indexes — mcp* collections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates indexes on every mcp* collection (incl. TTL on expiry fields)', async () => {
    await createDatabaseIndexes();
    const touched = new Set(collection.mock.calls.map((c) => c[0]));
    for (const name of MCP) expect(touched.has(name)).toBe(true);

    // Exactly the five mcp* TTL indexes (scoped + exact, so a dropped one fails
    // — not merely arrayContaining, which the pre-existing manualTestLocks TTL
    // would also satisfy). mcpClients_lastUsedAt_ttl is the I6 client reaper
    // (90d), the other four use expireAfterSeconds:0 (MongoDB-side Date math).
    const mcpTtlNames = createIndex.mock.calls
      .filter(
        (c) =>
          c[1]?.expireAfterSeconds != null &&
          c[1]?.expireAfterSeconds >= 0 &&
          (c[1]?.name as string)?.startsWith('mcp')
      )
      .map((c) => c[1]?.name as string);
    expect(mcpTtlNames.sort()).toEqual([
      'mcpAuthCodes_expiry_ttl',
      'mcpAuthStates_expiry_ttl',
      'mcpClients_lastUsedAt_ttl',
      'mcpRateLimits_expiry_ttl',
      'mcpTokens_expiry_ttl',
    ]);
  });

  it('dropAllIndexes includes all six mcp* collections (MB)', async () => {
    await dropAllIndexes();
    const dropped = new Set(collection.mock.calls.map((c) => c[0]));
    for (const name of MCP) expect(dropped.has(name)).toBe(true);
  });
});
