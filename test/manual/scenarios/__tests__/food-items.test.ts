// test/manual/scenarios/__tests__/food-items.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

// We import the block after the test helpers are defined
import { block as foodItems } from '../food-items.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** A minimal doc returned by findOne (simulating an already-existing item). */
function makeExistingDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    name: 'Apples',
    singularName: 'Apple',
    pluralName: 'Apples',
    unit: 'each',
    ...overrides,
  };
}

/**
 * Build a mock Db that records calls and can be configured per collection.
 * `foodItemsStore` drives what findOne / insertOne return for the foodItems collection.
 */
function mockDb(
  opts: {
    existingDoc?: ReturnType<typeof makeExistingDoc> | null;
  } = {}
) {
  const { existingDoc = null } = opts;

  const insertOne = vi.fn(async () => ({ insertedId: new ObjectId() }));
  const findOne = vi.fn(async () => existingDoc);
  const deleteMany = vi.fn(async () => ({ deletedCount: 2 }));
  const countDocuments = vi.fn(async () => (existingDoc ? 1 : 0));
  const collectionSpy = vi.fn((_name: string) => ({
    findOne,
    insertOne,
    deleteMany,
    countDocuments,
  }));

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return { db, insertOne, findOne, deleteMany, countDocuments, collectionSpy };
}

/** Build a BlockContext mock. resolve('u') returns a user-baseline-like state. */
function mockCtx(db: import('mongodb').Db, scenarioId = 'fi') {
  return {
    db,
    manifestId: 'feat/test::default',
    scenarioId,
    resolve: vi.fn((id: string) => {
      if (id === 'u') return { userId: 'u1', email: 'a@b.c', name: 'A' };
      throw new Error(`unexpected resolve id: ${id}`);
    }),
  };
}

// ─── validate ───────────────────────────────────────────────────────────────

describe('food-items.validate', () => {
  it('accepts empty config', () => {
    expect(foodItems.validate({})).toMatchObject({ isApproved: true });
  });

  it('accepts full config', () => {
    const cfg = foodItems.validate({
      ensure: ['apple'],
      globalCount: 3,
      userCount: 2,
      isApproved: false,
    });
    expect(cfg).toMatchObject({
      ensure: ['apple'],
      globalCount: 3,
      userCount: 2,
      isApproved: false,
    });
  });

  it('defaults isApproved to true', () => {
    expect(foodItems.validate({ globalCount: 1 })).toMatchObject({ isApproved: true });
  });

  it('rejects negative globalCount', () => {
    expect(() => foodItems.validate({ globalCount: -1 })).toThrow();
  });

  it('rejects non-integer globalCount', () => {
    expect(() => foodItems.validate({ globalCount: 1.5 })).toThrow();
  });

  it('rejects non-array ensure', () => {
    expect(() => foodItems.validate({ ensure: 'apple' })).toThrow();
  });

  it('rejects malformed: unknown shape', () => {
    expect(() => foodItems.validate({ isApproved: 'yes' })).toThrow();
  });
});

// ─── apply — ensure items ────────────────────────────────────────────────────

describe('food-items.apply — ensure', () => {
  it('inserts apple when not already present, keys result by plural name', async () => {
    const { db, insertOne, collectionSpy } = mockDb({ existingDoc: null });
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ ensure: ['apple'] });

    const result = await foodItems.apply(cfg, ctx);

    // collection called with exactly 'foodItems'
    expect(collectionSpy).toHaveBeenCalledWith('foodItems');
    expect(collectionSpy).not.toHaveBeenCalledWith(expect.not.stringMatching(/^foodItems$/));

    // inserted doc has _seedManifestId and _seedScenarioId
    const inserted = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted._seedManifestId).toBe('feat/test::default');
    expect(inserted._seedScenarioId).toBe('fi');

    // state keyed by plural name 'apples' (lower-case plural of 'apple')
    expect(result.state.foodItemIds).toHaveProperty('Apples');
    expect(result.state.foodItemIds['Apples']).toBeInstanceOf(ObjectId);

    // summary is a non-empty string
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('resolves user state via ctx.resolve("u")', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ ensure: ['bread'] });

    await foodItems.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('u');
  });

  it('uses correct singular/plural/unit for known food "apple"', async () => {
    const { db, insertOne } = mockDb({ existingDoc: null });
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ ensure: ['apple'] });

    await foodItems.apply(cfg, ctx);

    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.singularName).toBe('Apple');
    expect(doc.pluralName).toBe('Apples');
    expect(doc.unit).toBe('each');
    expect(doc.name).toBe('Apples');
  });

  it('falls back to default naming for unknown food items', async () => {
    const { db, insertOne } = mockDb({ existingDoc: null });
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ ensure: ['frobnitz'] });

    await foodItems.apply(cfg, ctx);

    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.singularName).toBe('frobnitz');
    expect(doc.pluralName).toBe('frobnitzs');
    expect(doc.unit).toBe('each');
  });
});

// ─── apply — globalCount / userCount ────────────────────────────────────────

describe('food-items.apply — globalCount / userCount', () => {
  it('inserts N global items with isGlobal: true', async () => {
    const { db, insertOne } = mockDb({ existingDoc: null });
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ globalCount: 2 });

    const result = await foodItems.apply(cfg, ctx);

    expect(insertOne).toHaveBeenCalledTimes(2);
    const docs = insertOne.mock.calls.map((c) => c[0] as Record<string, unknown>);
    docs.forEach((doc) => expect(doc.isGlobal).toBe(true));

    expect(Object.keys(result.state.foodItemIds)).toHaveLength(2);
  });

  it('inserts N user items with isGlobal: false', async () => {
    const { db, insertOne } = mockDb({ existingDoc: null });
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ userCount: 3 });

    const result = await foodItems.apply(cfg, ctx);

    expect(insertOne).toHaveBeenCalledTimes(3);
    const docs = insertOne.mock.calls.map((c) => c[0] as Record<string, unknown>);
    docs.forEach((doc) => expect(doc.isGlobal).toBe(false));
    expect(Object.keys(result.state.foodItemIds)).toHaveLength(3);
  });

  it('inserted generated docs have correct seed marker fields', async () => {
    const { db, insertOne } = mockDb({ existingDoc: null });
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ globalCount: 1 });

    await foodItems.apply(cfg, ctx);

    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('fi');
  });

  it('isApproved on inserted docs follows config', async () => {
    const { db, insertOne } = mockDb({ existingDoc: null });
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ globalCount: 1, isApproved: false });

    await foodItems.apply(cfg, ctx);

    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.isApproved).toBe(false);
  });
});

// ─── apply — idempotency ─────────────────────────────────────────────────────

describe('food-items.apply — idempotency', () => {
  it('does not double-insert when findOne returns an existing doc', async () => {
    const existing = makeExistingDoc({ singularName: 'Apple', pluralName: 'Apples' });
    const { db, insertOne } = mockDb({ existingDoc: existing });
    const ctx = mockCtx(db);
    const cfg = foodItems.validate({ ensure: ['apple'] });

    const result = await foodItems.apply(cfg, ctx);

    // findOne found existing → should NOT insertOne
    expect(insertOne).not.toHaveBeenCalled();

    // state still contains the key from the existing doc's _id
    expect(result.state.foodItemIds['Apples']).toEqual(existing._id);
  });
});

// ─── clean ───────────────────────────────────────────────────────────────────

describe('food-items.clean', () => {
  it('calls deleteMany with _seedManifestId and _seedScenarioId filter', async () => {
    const { db, deleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    const result = await foodItems.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('foodItems');
    expect(deleteMany).toHaveBeenCalledWith({
      _seedManifestId: 'feat/test::default',
      _seedScenarioId: 'fi',
    });
    expect(result.docCount).toBe(2); // deletedCount from mock
  });
});

// ─── status ──────────────────────────────────────────────────────────────────

describe('food-items.status', () => {
  it('returns present=true when docs exist', async () => {
    const { db, countDocuments } = mockDb({ existingDoc: makeExistingDoc() });
    countDocuments.mockResolvedValue(3);
    const ctx = mockCtx(db);

    const s = await foodItems.status(ctx);

    expect(s.present).toBe(true);
    expect(s.docCount).toBe(3);
    expect(typeof s.configHashMatches).toBe('boolean');
  });

  it('returns present=false when no docs', async () => {
    const { db, countDocuments } = mockDb({ existingDoc: null });
    countDocuments.mockResolvedValue(0);
    const ctx = mockCtx(db);

    const s = await foodItems.status(ctx);

    expect(s.present).toBe(false);
    expect(s.docCount).toBe(0);
  });
});

// ─── block metadata ──────────────────────────────────────────────────────────

describe('food-items block metadata', () => {
  it('has name "food-items"', () => {
    expect(foodItems.name).toBe('food-items');
  });

  it('declares collectionsWritten: ["foodItems"]', () => {
    expect(foodItems.documentation.collectionsWritten).toEqual(['foodItems']);
  });

  it('declares dependencies: ["user-baseline"]', () => {
    expect(foodItems.documentation.dependencies).toEqual(['user-baseline']);
  });

  it('documents the "u" id convention', () => {
    expect(foodItems.documentation.description).toMatch(/"u"/);
  });
});
