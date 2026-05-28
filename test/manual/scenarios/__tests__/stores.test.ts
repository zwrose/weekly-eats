// test/manual/scenarios/__tests__/stores.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';

import { block as stores } from '../stores.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFoodId() {
  return new ObjectId();
}

/**
 * Build a mock Db that records calls.
 * `existingCount` drives idempotency: find().toArray() for stores.
 */
function mockDb(opts: { existingCount?: number } = {}) {
  const { existingCount = 0 } = opts;

  const storeInsertOne = vi.fn(async () => ({ insertedId: new ObjectId() }));
  const storeDeleteMany = vi.fn(async () => ({ deletedCount: existingCount || 0 }));
  const storeToArray = vi.fn(async () =>
    existingCount > 0 ? Array.from({ length: existingCount }, () => ({ _id: new ObjectId() })) : []
  );
  const storeFind = vi.fn(() => ({ toArray: storeToArray }));

  const posInsertOne = vi.fn(async () => ({ insertedId: new ObjectId() }));
  const posDeleteMany = vi.fn(async () => ({ deletedCount: 0 }));

  const collectionSpy = vi.fn((name: string) => {
    if (name === 'storeItemPositions') {
      return { insertOne: posInsertOne, deleteMany: posDeleteMany };
    }
    // stores collection
    return {
      insertOne: storeInsertOne,
      deleteMany: storeDeleteMany,
      find: storeFind,
    };
  });

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return {
    db,
    storeInsertOne,
    storeDeleteMany,
    storeToArray,
    storeFind,
    posInsertOne,
    posDeleteMany,
    collectionSpy,
  };
}

/**
 * Build a BlockContext mock.
 * resolve('u') → user-baseline state.
 * resolve('fi') → food-items state with foodItemIds map.
 */
function mockCtx(db: import('mongodb').Db, scenarioId = 's', foodIds?: Record<string, ObjectId>) {
  const defaultFoodIds = {
    Apples: makeFoodId(),
    Bread: makeFoodId(),
  };
  const resolvedFoodIds = foodIds ?? defaultFoodIds;
  return {
    db,
    manifestId: 'feat/test::default',
    scenarioId,
    resolve: vi.fn((id: string) => {
      if (id === 'u') return { userId: 'u1', email: 'a@b.c', name: 'A' };
      if (id === 'fi') return { foodItemIds: resolvedFoodIds };
      throw new Error(`unexpected resolve id: ${id}`);
    }),
  };
}

// ─── validate ────────────────────────────────────────────────────────────────

describe('stores.validate', () => {
  it('accepts minimal valid config', () => {
    const cfg = stores.validate({ count: 2 });
    expect(cfg).toMatchObject({ count: 2 });
  });

  it('accepts config with withPositions=true and foodItemsRef', () => {
    const cfg = stores.validate({ count: 2, withPositions: true, foodItemsRef: 'fi' });
    expect(cfg).toMatchObject({ count: 2, withPositions: true, foodItemsRef: 'fi' });
  });

  it('accepts config with withPositions=false (no foodItemsRef needed)', () => {
    const cfg = stores.validate({ count: 1, withPositions: false });
    expect(cfg).toMatchObject({ count: 1, withPositions: false });
  });

  it('rejects count < 1', () => {
    expect(() => stores.validate({ count: 0 })).toThrow();
  });

  it('rejects non-integer count', () => {
    expect(() => stores.validate({ count: 1.5 })).toThrow();
  });

  it('rejects missing count', () => {
    expect(() => stores.validate({})).toThrow();
  });
});

// ─── apply — basic store insertion ───────────────────────────────────────────

describe('stores.apply — basic', () => {
  it('inserts count stores with both _seed* tags', async () => {
    const { db, storeInsertOne, collectionSpy } = mockDb();
    const ctx = mockCtx(db);
    const cfg = stores.validate({ count: 2 });

    await stores.apply(cfg, ctx);

    expect(collectionSpy).toHaveBeenCalledWith('stores');
    expect(storeInsertOne).toHaveBeenCalledTimes(2);

    const doc = storeInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('s');
    expect(doc.userId).toBe('u1');
    expect(typeof doc.name).toBe('string');
  });

  it('returns storeIds in state', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = stores.validate({ count: 3 });

    const result = await stores.apply(cfg, ctx);

    expect(result.state.storeIds).toHaveLength(3);
    result.state.storeIds.forEach((id: unknown) => expect(id).toBeInstanceOf(ObjectId));
  });

  it('resolves userId via ctx.resolve("u")', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = stores.validate({ count: 1 });

    await stores.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('u');
  });

  it('produces a non-empty summary string', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = stores.validate({ count: 1 });

    const result = await stores.apply(cfg, ctx);

    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('sets positionsPerStore=0 when withPositions is not set', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = stores.validate({ count: 1 });

    const result = await stores.apply(cfg, ctx);

    expect(result.state.positionsPerStore).toBe(0);
  });
});

// ─── apply — withPositions ────────────────────────────────────────────────────

describe('stores.apply — withPositions', () => {
  it('inserts positions for each (store, foodItem) pair', async () => {
    const foodId1 = makeFoodId();
    const foodId2 = makeFoodId();
    const { db, posInsertOne, collectionSpy } = mockDb();
    const ctx = mockCtx(db, 's', { Apples: foodId1, Bread: foodId2 });
    const cfg = stores.validate({ count: 2, withPositions: true, foodItemsRef: 'fi' });

    await stores.apply(cfg, ctx);

    expect(collectionSpy).toHaveBeenCalledWith('storeItemPositions');
    // 2 stores × 2 foodItems = 4 positions
    expect(posInsertOne).toHaveBeenCalledTimes(4);
  });

  it('position docs have both _seed* tags and a position number 0..1', async () => {
    const foodId1 = makeFoodId();
    const { db, posInsertOne } = mockDb();
    const ctx = mockCtx(db, 's', { Apples: foodId1 });
    const cfg = stores.validate({ count: 1, withPositions: true, foodItemsRef: 'fi' });

    await stores.apply(cfg, ctx);

    const posDoc = posInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(posDoc._seedManifestId).toBe('feat/test::default');
    expect(posDoc._seedScenarioId).toBe('s');
    expect(typeof posDoc.position).toBe('number');
    expect(posDoc.position as number).toBeGreaterThanOrEqual(0);
    expect(posDoc.position as number).toBeLessThanOrEqual(1);
  });

  it('sets positionsPerStore to the number of foodItems', async () => {
    const foodId1 = makeFoodId();
    const foodId2 = makeFoodId();
    const { db } = mockDb();
    const ctx = mockCtx(db, 's', { Apples: foodId1, Bread: foodId2 });
    const cfg = stores.validate({ count: 2, withPositions: true, foodItemsRef: 'fi' });

    const result = await stores.apply(cfg, ctx);

    expect(result.state.positionsPerStore).toBe(2);
  });

  it('summary includes "with positions" when withPositions=true', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db, 's', { Apples: makeFoodId() });
    const cfg = stores.validate({ count: 1, withPositions: true, foodItemsRef: 'fi' });

    const result = await stores.apply(cfg, ctx);

    expect(result.summary).toMatch(/with positions/i);
  });

  it('throws a clear error when withPositions=true but foodItemsRef is missing', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = stores.validate({ count: 1, withPositions: true });

    await expect(stores.apply(cfg, ctx)).rejects.toThrow(/foodItemsRef/);
  });
});

// ─── apply — idempotency ──────────────────────────────────────────────────────

describe('stores.apply — idempotency', () => {
  it('does not re-insert when tagged store docs already exist', async () => {
    const { db, storeInsertOne } = mockDb({ existingCount: 2 });
    const ctx = mockCtx(db);
    const cfg = stores.validate({ count: 2 });

    const result = await stores.apply(cfg, ctx);

    expect(storeInsertOne).not.toHaveBeenCalled();
    expect(result.state.storeIds).toHaveLength(2);
  });
});

// ─── clean ────────────────────────────────────────────────────────────────────

describe('stores.clean', () => {
  it('calls deleteMany on stores with tag filter', async () => {
    const { db, storeDeleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await stores.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('stores');
    expect(storeDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _seedManifestId: 'feat/test::default',
        _seedScenarioId: 's',
      })
    );
  });

  it('calls deleteMany on storeItemPositions with tag filter', async () => {
    const { db, posDeleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await stores.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('storeItemPositions');
    expect(posDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _seedManifestId: 'feat/test::default',
        _seedScenarioId: 's',
      })
    );
  });

  it('returns combined docCount from both collections', async () => {
    const { db } = mockDb({ existingCount: 3 });
    const ctx = mockCtx(db);

    const result = await stores.clean(ctx);

    expect(typeof result.docCount).toBe('number');
    expect(result.docCount).toBeGreaterThanOrEqual(0);
  });
});

// ─── block metadata ───────────────────────────────────────────────────────────

describe('stores block metadata', () => {
  it('has name "stores"', () => {
    expect(stores.name).toBe('stores');
  });

  it('declares collectionsWritten including both "stores" and "storeItemPositions"', () => {
    expect(stores.documentation.collectionsWritten).toContain('stores');
    expect(stores.documentation.collectionsWritten).toContain('storeItemPositions');
  });

  it('declares dependencies including "user-baseline"', () => {
    expect(stores.documentation.dependencies).toContain('user-baseline');
  });

  it('documents the "u" id convention', () => {
    expect(stores.documentation.description).toMatch(/"u"/);
  });
});
