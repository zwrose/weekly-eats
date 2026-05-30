// src/lib/mcp/oauth/stores/rate-limit.ts
import { getMongoClient } from '@/lib/mongodb';
import type { McpRateLimitDoc } from '@/lib/mcp/oauth/types';

async function limits() {
  const client = await getMongoClient();
  return client.db().collection<McpRateLimitDoc>('mcpRateLimits');
}

/**
 * Fixed-window per-key counter. Returns { allowed } for this hit. A new window
 * starts when the stored windowStart is older than windowMs. expiresAt feeds the
 * TTL index (cleanup only — the windowStart comparison is the real gate).
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): Promise<{ allowed: boolean }> {
  const col = await limits();
  const doc = await col.findOne({ key });
  if (!doc || now - doc.windowStart >= windowMs) {
    await col.updateOne(
      { key },
      { $set: { key, count: 1, windowStart: now, expiresAt: now + windowMs } },
      { upsert: true }
    );
    return { allowed: true };
  }
  if (doc.count >= limit) return { allowed: false };
  await col.updateOne({ key }, { $set: { count: doc.count + 1 } });
  return { allowed: true };
}
