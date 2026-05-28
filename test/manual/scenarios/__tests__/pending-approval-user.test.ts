// test/manual/scenarios/__tests__/pending-approval-user.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';

import pendingApprovalUser from '../pending-approval-user.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockDb(opts: { existingDocs?: Array<{ _id: ObjectId; email: string }> } = {}) {
  const { existingDocs = [] } = opts;

  const usersInsertOne = vi.fn(async () => ({ insertedId: new ObjectId() }));
  const usersDeleteMany = vi.fn(async () => ({ deletedCount: existingDocs.length }));
  const usersCountDocuments = vi.fn(async () => existingDocs.length);

  const usersToArray = vi.fn(async () => existingDocs);
  const usersFind = vi.fn(() => ({ toArray: usersToArray }));

  const collectionSpy = vi.fn((_name: string) => ({
    insertOne: usersInsertOne,
    deleteMany: usersDeleteMany,
    countDocuments: usersCountDocuments,
    find: usersFind,
  }));

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return { db, usersInsertOne, usersDeleteMany, usersCountDocuments, usersFind, collectionSpy };
}

function mockCtx(db: import('mongodb').Db, scenarioId = 'pau') {
  return {
    db,
    manifestId: 'feat/test::default',
    scenarioId,
    resolve: vi.fn((_id: string) => {
      throw new Error('pending-approval-user should not call resolve');
    }),
  };
}

// ─── validate ────────────────────────────────────────────────────────────────

describe('pendingApprovalUser.validate', () => {
  it('accepts empty config {}', () => {
    const cfg = pendingApprovalUser.validate({});
    expect(cfg).toBeDefined();
  });

  it('accepts {name: "Foo Bar"}', () => {
    const cfg = pendingApprovalUser.validate({ name: 'Foo Bar' });
    expect(cfg).toMatchObject({ name: 'Foo Bar' });
  });

  it('config schema has no `email` field by default', () => {
    // The block hard-codes the @manual-test.invalid email domain (see apply
    // tests below). The config schema must NOT surface an email knob.
    const cfg = pendingApprovalUser.validate({});
    expect(cfg).not.toHaveProperty('email');
  });

  it('strips unknown fields like `email` at validate time', () => {
    // Zod's default (no .strict()) is to silently strip unknown keys. This
    // test pins that behavior so a user-supplied email cannot leak through
    // into apply(). If we ever want hard rejection, switch the schema to
    // .strict() and change this assertion to .toThrow().
    const cfg = pendingApprovalUser.validate({
      name: 'Foo',
      email: 'attacker@example.com',
    } as unknown);
    expect(cfg).not.toHaveProperty('email');
    expect(cfg).toMatchObject({ name: 'Foo' });
  });
});

// ─── apply — email domain enforcement ────────────────────────────────────────

describe('pendingApprovalUser.apply — forced @manual-test.invalid email', () => {
  it('ALWAYS generates email ending with @manual-test.invalid', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    const result = await pendingApprovalUser.apply(cfg, ctx);

    expect(result.state.email).toMatch(/@manual-test\.invalid$/);
  });

  it('email starts with manual-test+ prefix', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    const result = await pendingApprovalUser.apply(cfg, ctx);

    expect(result.state.email).toMatch(/^manual-test\+/);
  });

  it('email is different on each call (random hex segment)', async () => {
    const { db: db1 } = mockDb();
    const { db: db2 } = mockDb();
    const cfg = pendingApprovalUser.validate({});

    const r1 = await pendingApprovalUser.apply(cfg, mockCtx(db1, 'pau1'));
    const r2 = await pendingApprovalUser.apply(cfg, mockCtx(db2, 'pau2'));

    expect(r1.state.email).not.toBe(r2.state.email);
  });

  it('inserted doc has the generated email as its email field', async () => {
    const { db, usersInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    const result = await pendingApprovalUser.apply(cfg, ctx);

    const doc = usersInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.email).toBe(result.state.email);
  });
});

// ─── apply — isApproved and user fields ──────────────────────────────────────

describe('pendingApprovalUser.apply — user document', () => {
  it('inserts with isApproved: false', async () => {
    const { db, usersInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    await pendingApprovalUser.apply(cfg, ctx);

    const doc = usersInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.isApproved).toBe(false);
  });

  it('uses default name when name not provided', async () => {
    const { db, usersInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    await pendingApprovalUser.apply(cfg, ctx);

    const doc = usersInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof doc.name).toBe('string');
    expect((doc.name as string).length).toBeGreaterThan(0);
  });

  it('uses config.name when provided', async () => {
    const { db, usersInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({ name: 'Jane Tester' });

    await pendingApprovalUser.apply(cfg, ctx);

    const doc = usersInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.name).toBe('Jane Tester');
  });

  it('inserts into users collection', async () => {
    const { db, collectionSpy } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    await pendingApprovalUser.apply(cfg, ctx);

    expect(collectionSpy).toHaveBeenCalledWith('users');
  });

  it('returns pendingUserId as ObjectId', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    const result = await pendingApprovalUser.apply(cfg, ctx);

    expect(result.state.pendingUserId).toBeInstanceOf(ObjectId);
  });
});

// ─── apply — tags ─────────────────────────────────────────────────────────────

describe('pendingApprovalUser.apply — tags', () => {
  it('tags doc with both _seed* fields', async () => {
    const { db, usersInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    await pendingApprovalUser.apply(cfg, ctx);

    const doc = usersInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('pau');
  });
});

// ─── apply — idempotency ─────────────────────────────────────────────────────

describe('pendingApprovalUser.apply — idempotency', () => {
  it('does not re-insert when a tagged user already exists', async () => {
    const existingEmail = 'manual-test+abcd1234@manual-test.invalid';
    const { db, usersInsertOne } = mockDb({
      existingDocs: [{ _id: new ObjectId(), email: existingEmail }],
    });
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    await pendingApprovalUser.apply(cfg, ctx);

    expect(usersInsertOne).not.toHaveBeenCalled();
  });

  it('returns existing email from state on idempotent call', async () => {
    const existingEmail = 'manual-test+abcd1234@manual-test.invalid';
    const existingId = new ObjectId();
    const { db } = mockDb({
      existingDocs: [{ _id: existingId, email: existingEmail }],
    });
    const ctx = mockCtx(db);
    const cfg = pendingApprovalUser.validate({});

    const result = await pendingApprovalUser.apply(cfg, ctx);

    expect(result.state.email).toBe(existingEmail);
  });
});

// ─── clean — CRITICAL: must not wipe other users ──────────────────────────────

describe('pendingApprovalUser.clean', () => {
  it('calls deleteMany on users with BOTH _seed* tag fields', async () => {
    const { db, usersDeleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await pendingApprovalUser.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('users');
    const filter = usersDeleteMany.mock.calls[0][0] as Record<string, unknown>;
    expect(filter).toHaveProperty('_seedManifestId', 'feat/test::default');
    expect(filter).toHaveProperty('_seedScenarioId', 'pau');
  });

  it('deleteMany filter does NOT rely on email alone (must include both tags)', async () => {
    const { db, usersDeleteMany } = mockDb();
    const ctx = mockCtx(db);

    await pendingApprovalUser.clean(ctx);

    const filter = usersDeleteMany.mock.calls[0][0] as Record<string, unknown>;
    // Must have both seed tags — not just email-based filtering
    expect(Object.keys(filter)).toContain('_seedManifestId');
    expect(Object.keys(filter)).toContain('_seedScenarioId');
  });

  it('returns docCount', async () => {
    const { db } = mockDb({ existingDocs: [{ _id: new ObjectId(), email: 'x@y.z' }] });
    const ctx = mockCtx(db);

    const result = await pendingApprovalUser.clean(ctx);

    expect(typeof result.docCount).toBe('number');
  });
});

// ─── block metadata ───────────────────────────────────────────────────────────

describe('pendingApprovalUser block metadata', () => {
  it('has name "pending-approval-user"', () => {
    expect(pendingApprovalUser.name).toBe('pending-approval-user');
  });

  it('declares collectionsWritten includes "users"', () => {
    expect(pendingApprovalUser.documentation.collectionsWritten).toContain('users');
  });

  it('declares empty dependencies array', () => {
    expect(pendingApprovalUser.documentation.dependencies).toEqual([]);
  });
});
