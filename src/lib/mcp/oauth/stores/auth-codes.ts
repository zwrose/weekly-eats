// src/lib/mcp/oauth/stores/auth-codes.ts
import { getMongoClient } from '@/lib/mongodb';
import { sha256Hex } from '@/lib/mcp/oauth/crypto';
import type { McpAuthCodeDoc } from '@/lib/mcp/oauth/types';

async function codes() {
  const client = await getMongoClient();
  return client.db().collection<McpAuthCodeDoc>('mcpAuthCodes');
}

type AuthCodeFields = Omit<McpAuthCodeDoc, '_id' | 'hashedCode' | 'expiresAt'>;

/** The grant lineage id derived from a raw code (tags tokens minted from it). */
export function grantIdForCode(rawCode: string): string {
  return sha256Hex(rawCode);
}

export async function issueAuthCode(
  rawCode: string,
  fields: AuthCodeFields,
  expiresAt: number
): Promise<void> {
  await (
    await codes()
  ).insertOne({ ...fields, hashedCode: sha256Hex(rawCode), expiresAt: new Date(expiresAt) });
}

/** Atomic single-use consume (MA) + at-use expiry (R6). */
export async function consumeAuthCode(
  rawCode: string,
  now: number
): Promise<McpAuthCodeDoc | null> {
  const doc = await (await codes()).findOneAndDelete({ hashedCode: sha256Hex(rawCode) });
  if (!doc || doc.expiresAt.getTime() <= now) return null;
  return doc;
}
