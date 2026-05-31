// src/lib/mcp/oauth/stores/__tests__/auth-codes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';
import { sha256Hex } from '../../crypto';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { consumeAuthCode, grantIdForCode, issueAuthCode } from '../auth-codes';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

const code = 'raw-code-value';
const fields = {
  clientId: 'c1',
  redirectUri: 'https://c/cb',
  codeChallenge: 'chal',
  resource: 'https://app.test/api/mcp',
  userId: 'u1',
  scope: 'weekly-eats:rw',
};

describe('auth-codes store', () => {
  it('issue + consume returns the bound fields once', async () => {
    await issueAuthCode(code, fields, 1000 + 60_000);
    const doc = await consumeAuthCode(code, 1000);
    expect(doc?.clientId).toBe('c1');
    expect(doc?.userId).toBe('u1');
  });

  it('a second consume of the same code returns null (single-use, MA)', async () => {
    await issueAuthCode(code, fields, 1000 + 60_000);
    expect(await consumeAuthCode(code, 1000)).not.toBeNull();
    expect(await consumeAuthCode(code, 1000)).toBeNull();
  });

  it('rejects an expired code at use (R6)', async () => {
    await issueAuthCode(code, fields, 1000 + 60_000);
    expect(await consumeAuthCode(code, 1000 + 60_001)).toBeNull();
  });

  it('grantIdForCode is the SHA-256 of the raw code', () => {
    expect(grantIdForCode(code)).toBe(sha256Hex(code));
  });

  it('stores only the code hash, never the raw code', async () => {
    await issueAuthCode(code, fields, 1000 + 60_000);
    const docs = fake.store.get('mcpAuthCodes')!;
    expect(docs[0].hashedCode).toBe(sha256Hex(code));
    expect(JSON.stringify(docs[0])).not.toContain(code);
  });
});
