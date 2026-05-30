// src/lib/mcp/oauth/stores/clients.ts
import { getMongoClient } from '@/lib/mongodb';
import { generateSecret } from '@/lib/mcp/oauth/crypto';
import type { McpClientDoc } from '@/lib/mcp/oauth/types';

async function clients() {
  const client = await getMongoClient();
  return client.db().collection<McpClientDoc>('mcpClients');
}

export async function registerClient(
  input: { clientName: string; redirectUris: string[] },
  now: number
): Promise<{ clientId: string }> {
  const clientId = generateSecret();
  await (
    await clients()
  ).insertOne({
    clientId,
    clientName: input.clientName,
    redirectUris: input.redirectUris,
    createdAt: now,
    lastUsedAt: new Date(now),
  });
  return { clientId };
}

export async function getClient(clientId: string): Promise<McpClientDoc | null> {
  return (await clients()).findOne({ clientId });
}

export async function touchClient(clientId: string, now: number): Promise<void> {
  await (await clients()).updateOne({ clientId }, { $set: { lastUsedAt: new Date(now) } });
}
