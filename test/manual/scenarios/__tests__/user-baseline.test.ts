// test/manual/scenarios/__tests__/user-baseline.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { block as userBaseline } from '../user-baseline.js';

function mockDb(users: Array<{ _id: string; email: string; name: string; isApproved: boolean }>) {
  return {
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          findOne: vi.fn(async (filter: any) => {
            if (filter.email) return users.find((u) => u.email === filter.email) ?? null;
            return users[0] ?? null;
          }),
          find: vi.fn(() => ({
            toArray: vi.fn(async () => users),
          })),
          countDocuments: vi.fn(async () => users.length),
        };
      }
      return {};
    }),
  } as any;
}

const ctx = (db: any) => ({
  db,
  manifestId: 'feat/x::default',
  scenarioId: 'u',
  resolve: () => {
    throw new Error('no');
  },
});

describe('user-baseline.validate', () => {
  it('accepts empty config', () => {
    expect(userBaseline.validate({})).toEqual({});
  });
  it('accepts config with email', () => {
    expect(userBaseline.validate({ email: 'a@b.c' })).toEqual({ email: 'a@b.c' });
  });
  it('rejects malformed', () => {
    expect(() => userBaseline.validate({ email: 123 })).toThrow();
  });
});

describe('user-baseline.apply', () => {
  beforeEach(() => delete process.env.MANUAL_TEST_USER_EMAIL);

  it('errors when no users exist', async () => {
    const db = mockDb([]);
    await expect(userBaseline.apply({}, ctx(db))).rejects.toThrow(/no.*user.*found/i);
  });

  it('uses single user when only one exists', async () => {
    const db = mockDb([{ _id: 'u1', email: 'only@a.com', name: 'Only', isApproved: true }]);
    const r = await userBaseline.apply({}, ctx(db));
    expect(r.state).toEqual({ userId: 'u1', email: 'only@a.com', name: 'Only' });
    expect(r.docCount).toBe(0);
    expect(r.summary).toMatch(/only@a\.com/);
  });

  it('errors with full list when multiple users and no email', async () => {
    const db = mockDb([
      { _id: 'u1', email: 'a@a.com', name: 'A', isApproved: true },
      { _id: 'u2', email: 'b@b.com', name: 'B', isApproved: true },
    ]);
    await expect(userBaseline.apply({}, ctx(db))).rejects.toThrow(
      /multiple users.*a@a\.com.*b@b\.com/i
    );
  });

  it('uses config.email when provided', async () => {
    const db = mockDb([
      { _id: 'u1', email: 'a@a.com', name: 'A', isApproved: true },
      { _id: 'u2', email: 'b@b.com', name: 'B', isApproved: true },
    ]);
    const r = await userBaseline.apply({ email: 'b@b.com' }, ctx(db));
    expect(r.state).toEqual({ userId: 'u2', email: 'b@b.com', name: 'B' });
  });

  it('uses MANUAL_TEST_USER_EMAIL when no config.email', async () => {
    process.env.MANUAL_TEST_USER_EMAIL = 'b@b.com';
    const db = mockDb([
      { _id: 'u1', email: 'a@a.com', name: 'A', isApproved: true },
      { _id: 'u2', email: 'b@b.com', name: 'B', isApproved: true },
    ]);
    const r = await userBaseline.apply({}, ctx(db));
    expect(r.state).toEqual({ userId: 'u2', email: 'b@b.com', name: 'B' });
  });

  it('errors when chosen user is not approved', async () => {
    const db = mockDb([{ _id: 'u1', email: 'a@a.com', name: 'A', isApproved: false }]);
    await expect(userBaseline.apply({}, ctx(db))).rejects.toThrow(/isApproved/i);
  });
});

describe('user-baseline.clean / status', () => {
  it('clean is a no-op for docs (returns docCount: 0)', async () => {
    const db = mockDb([]);
    const r = await userBaseline.clean(ctx(db));
    expect(r.docCount).toBe(0);
  });
  it('status returns present=true when user exists', async () => {
    const db = mockDb([{ _id: 'u1', email: 'a@a.com', name: 'A', isApproved: true }]);
    const s = await userBaseline.status(ctx(db));
    expect(s.present).toBe(true);
  });
});
