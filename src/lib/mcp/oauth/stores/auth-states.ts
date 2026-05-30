// src/lib/mcp/oauth/stores/auth-states.ts
import { getMongoClient } from '@/lib/mongodb';
import { generateSecret, sha256Hex } from '@/lib/mcp/oauth/crypto';
import type { McpAuthStateDoc } from '@/lib/mcp/oauth/types';

async function states() {
  const client = await getMongoClient();
  return client.db().collection<McpAuthStateDoc>('mcpAuthStates');
}

type AuthStateInput = Omit<McpAuthStateDoc, '_id' | 'hashedState' | 'expiresAt'>;

/**
 * Creates a single-use state nonce. Returns the RAW nonce (stored hashed) AND
 * the inserted doc, so a caller that already has a session can proceed without
 * a redundant read-back of the row it just wrote (arch-004).
 */
export async function createAuthState(
  input: AuthStateInput,
  now: number,
  expiresAt: number
): Promise<{ nonce: string; doc: McpAuthStateDoc }> {
  const nonce = generateSecret();
  const doc: McpAuthStateDoc = {
    ...input,
    hashedState: sha256Hex(nonce),
    expiresAt,
  };
  await (await states()).insertOne(doc);
  return { nonce, doc };
}

/** Read without consuming (consent render). Enforces at-use expiry (R6). */
export async function peekAuthState(nonce: string, now: number): Promise<McpAuthStateDoc | null> {
  const doc = await (await states()).findOne({ hashedState: sha256Hex(nonce) });
  if (!doc || doc.expiresAt <= now) return null;
  return doc;
}

/** Single-use consume: delete + at-use expiry. Returns the doc, or null. */
export async function consumeAuthState(
  nonce: string,
  now: number
): Promise<McpAuthStateDoc | null> {
  const doc = await (await states()).findOneAndDelete({ hashedState: sha256Hex(nonce) });
  if (!doc || doc.expiresAt <= now) return null;
  return doc;
}
