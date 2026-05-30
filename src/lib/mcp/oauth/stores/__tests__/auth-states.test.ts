// src/lib/mcp/oauth/stores/__tests__/auth-states.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';
import { sha256Hex } from '../../crypto';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { consumeAuthState, createAuthState, peekAuthState } from '../auth-states';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

const base = {
  clientId: 'c1',
  redirectUri: 'https://c/cb',
  codeChallenge: 'chal',
  resource: 'https://app.test/api/mcp',
  scope: 'weekly-eats:rw',
  clientState: 'client-xyz',
};

describe('auth-states store', () => {
  it('createAuthState returns the raw nonce + inserted doc; peek reads it by raw nonce', async () => {
    const { nonce, doc: created } = await createAuthState(base, 1000, 1000 + 600_000);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    // the returned doc lets an authed caller skip a read-back (arch-004)
    expect(created.clientId).toBe('c1');
    expect(created.expiresAt).toBe(1000 + 600_000);
    const doc = await peekAuthState(nonce, 1000);
    expect(doc?.clientId).toBe('c1');
    expect(doc?.clientState).toBe('client-xyz');
  });

  it('peek rejects an expired state by at-use comparison (test-001/R6)', async () => {
    const { nonce } = await createAuthState(base, 1000, 1000 + 600_000);
    expect(await peekAuthState(nonce, 1000 + 600_001)).toBeNull();
  });

  it('consumeAuthState deletes (single-use) and returns the doc', async () => {
    const { nonce } = await createAuthState(base, 1000, 1000 + 600_000);
    expect(await consumeAuthState(nonce, 2000)).not.toBeNull();
    expect(await consumeAuthState(nonce, 2000)).toBeNull(); // gone
  });

  it('a nonce from session A is not found under a different nonce (MC isolation)', async () => {
    await createAuthState(base, 1000, 1000 + 600_000);
    expect(await peekAuthState('some-other-nonce', 1000)).toBeNull();
  });

  it('stores only the hash, never the raw nonce', async () => {
    const { nonce } = await createAuthState(base, 1000, 1000 + 600_000);
    const docs = fake.store.get('mcpAuthStates')!;
    expect(docs[0].hashedState).toBe(sha256Hex(nonce));
    expect(JSON.stringify(docs[0])).not.toContain(nonce);
  });
});
