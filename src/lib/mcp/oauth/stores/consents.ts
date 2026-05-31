// src/lib/mcp/oauth/stores/consents.ts
import { getMongoClient } from '@/lib/mongodb';
import type { McpConsentDoc } from '@/lib/mcp/oauth/types';

async function consents() {
  const client = await getMongoClient();
  return client.db().collection<McpConsentDoc>('mcpConsents');
}

/** Exact (userId, clientId, scope) match — a new client or scope re-prompts (CS1). */
export async function hasConsent(
  userId: string,
  clientId: string,
  scope: string
): Promise<boolean> {
  const doc = await (await consents()).findOne({ userId, clientId });
  return doc?.scope === scope;
}

export async function grantConsent(
  userId: string,
  clientId: string,
  scope: string,
  now: number
): Promise<void> {
  await (
    await consents()
  ).updateOne(
    { userId, clientId },
    { $set: { scope, grantedAt: now }, $setOnInsert: { userId, clientId } },
    { upsert: true }
  );
}
