// src/lib/mcp/oauth/stores/rate-limit.ts
import { getMongoClient } from '@/lib/mongodb';
import type { McpRateLimitDoc } from '@/lib/mcp/oauth/types';

async function limits() {
  const client = await getMongoClient();
  return client.db().collection<McpRateLimitDoc>('mcpRateLimits');
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Fixed-window per-key counter. Returns { allowed } for this hit. A new window
 * starts when the stored windowStart is older than windowMs. expiresAt feeds the
 * TTL index (cleanup only — the windowStart comparison is the real gate).
 *
 * Atomic: the count is mutated only via `$inc` inside conditional updates, so a
 * concurrent burst at the window boundary can't read-then-write past the limit
 * (the unique `key` index serializes window creation). Each hit is one of:
 *   1. live window  → atomic `$inc` (one round-trip);
 *   2. expired/absent → atomic upsert that opens a fresh window;
 *   3. lost the create race → fall back to `$inc` on the window that won.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): Promise<{ allowed: boolean }> {
  const col = await limits();
  const windowFloor = now - windowMs;

  // 1. Live window → bump the counter atomically.
  const live = await col.findOneAndUpdate(
    { key, windowStart: { $gt: windowFloor } },
    { $inc: { count: 1 } },
    { returnDocument: 'after' }
  );
  if (live) return { allowed: live.count <= limit };

  // 2. No live window → open one. The `$lte` filter resets only an expired
  //    window; if the doc doesn't exist the upsert creates it. A row that's
  //    actually live (a concurrent opener won) fails the filter, so the upsert
  //    tries to insert a duplicate `key` → E11000.
  try {
    await col.updateOne(
      { key, windowStart: { $lte: windowFloor } },
      { $set: { key, count: 1, windowStart: now, expiresAt: new Date(now + windowMs) } },
      { upsert: true }
    );
    return { allowed: true };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    // 3. Lost the create race → the winning window is live; bump it.
    const raced = await col.findOneAndUpdate(
      { key },
      { $inc: { count: 1 } },
      { returnDocument: 'after' }
    );
    return { allowed: (raced?.count ?? limit + 1) <= limit };
  }
}
