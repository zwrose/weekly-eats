// src/lib/mcp/oauth/stores/__tests__/consents.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { grantConsent, hasConsent } from '../consents';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

describe('consents store', () => {
  it('hasConsent is false before granting', async () => {
    expect(await hasConsent('u1', 'c1', 'weekly-eats:rw')).toBe(false);
  });

  it('grantConsent then hasConsent matches on exact (userId, clientId, scope)', async () => {
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 1000);
    expect(await hasConsent('u1', 'c1', 'weekly-eats:rw')).toBe(true);
  });

  it('a different clientId does not match (silent-authorization guard)', async () => {
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 1000);
    expect(await hasConsent('u1', 'c2', 'weekly-eats:rw')).toBe(false);
  });

  it('a different scope does not match', async () => {
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 1000);
    expect(await hasConsent('u1', 'c1', 'other-scope')).toBe(false);
  });

  it('grantConsent is idempotent (re-grant updates the row, no duplicate)', async () => {
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 1000);
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 2000);
    expect(fake.store.get('mcpConsents')!.length).toBe(1);
  });
});
