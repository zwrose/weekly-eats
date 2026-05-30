// src/lib/mcp/oauth/stores/__tests__/clients.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { getClient, registerClient, touchClient } from '../clients';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

describe('clients store', () => {
  it('registerClient persists and getClient reads it back', async () => {
    const { clientId } = await registerClient(
      { clientName: 'Claude', redirectUris: ['https://claude.ai/cb'] },
      1000
    );
    expect(clientId).toMatch(/^[A-Za-z0-9_-]+$/);
    const doc = await getClient(clientId);
    expect(doc?.clientName).toBe('Claude');
    expect(doc?.redirectUris).toEqual(['https://claude.ai/cb']);
    expect(doc?.createdAt).toBe(1000);
  });

  it('getClient returns null for an unknown clientId (T4)', async () => {
    expect(await getClient('nope')).toBeNull();
  });

  it('touchClient updates lastUsedAt', async () => {
    const { clientId } = await registerClient(
      { clientName: 'C', redirectUris: ['https://x/cb'] },
      1000
    );
    await touchClient(clientId, 5000);
    expect((await getClient(clientId))?.lastUsedAt).toBe(5000);
  });
});
