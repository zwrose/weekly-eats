// test/manual/scenarios/__tests__/pantry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

import pantry from '../pantry.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFoodId() {
  return new ObjectId();
}

/**
 * Build a mock Db that records calls.
 * `existingCount` drives countDocuments and the idempotency find().toArray().
 * `foodItemDocs` drives the foodItems find().limit().toArray() chain.
 */
function mockDb(
  opts: {
    existingCount?: number;
    foodItemDocs?: Array<{ _id: ObjectId }>;
  } = {}
) {
  const { existingCount = 0, foodItemDocs = [] } = opts;

  const pantryInsertOne = vi.fn(async () => ({ insertedId: new ObjectId() }));
  const pantryDeleteMany = vi.fn(async () => ({ deletedCount: existingCount || 0 }));

  // Simulates find({}).limit(n).toArray() for foodItems
  const foodItemsToArray = vi.fn(async () => foodItemDocs);
  const foodItemsLimit = vi.fn(() => ({ toArray: foodItemsToArray }));
  const foodItemsFind = vi.fn(() => ({ limit: foodItemsLimit }));

  // Simulates find(tagFilter).toArray() for pantry idempotency
  const pantryToArray = vi.fn(async () =>
    existingCount > 0 ? Array.from({ length: existingCount }, () => ({ _id: new ObjectId() })) : []
  );
  const pantryFind = vi.fn(() => ({ toArray: pantryToArray }));

  const collectionSpy = vi.fn((name: string) => {
    if (name === 'foodItems') {
      return { find: foodItemsFind };
    }
    // pantry collection
    return {
      insertOne: pantryInsertOne,
      deleteMany: pantryDeleteMany,
      find: pantryFind,
    };
  });

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return {
    db,
    pantryInsertOne,
    pantryDeleteMany,
    pantryToArray,
    pantryFind,
    foodItemsFind,
    foodItemsLimit,
    foodItemsToArray,
    collectionSpy,
  };
}

/**
 * Build a BlockContext mock.
 * resolve('u') → user-baseline state.
 * resolve('fi') → food-items state with foodItemIds map.
 */
function mockCtx(db: import('mongodb').Db, scenarioId = 'p', foodIds?: Record<string, ObjectId>) {
  const defaultFoodIds = {
    Apples: makeFoodId(),
    Bread: makeFoodId(),
    Eggs: makeFoodId(),
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

describe('pantry.validate', () => {
  it('accepts minimal valid config', () => {
    const cfg = pantry.validate({ count: 2 });
    expect(cfg).toMatchObject({ count: 2 });
  });

  it('accepts config with foodItemsRef', () => {
    const cfg = pantry.validate({ count: 3, foodItemsRef: 'fi' });
    expect(cfg).toMatchObject({ count: 3, foodItemsRef: 'fi' });
  });

  it('rejects count < 1', () => {
    expect(() => pantry.validate({ count: 0 })).toThrow();
  });

  it('rejects non-integer count', () => {
    expect(() => pantry.validate({ count: 1.5 })).toThrow();
  });

  it('rejects missing count', () => {
    expect(() => pantry.validate({})).toThrow();
  });
});

// ─── apply — with foodItemsRef ────────────────────────────────────────────────

describe('pantry.apply — with foodItemsRef', () => {
  it('resolves foodItemIds from the ref instead of querying foodItems collection', async () => {
    const foodId1 = makeFoodId();
    const foodId2 = makeFoodId();
    const { db, pantryInsertOne, foodItemsFind, collectionSpy } = mockDb();
    const ctx = mockCtx(db, 'p', { Apples: foodId1, Bread: foodId2 });
    const cfg = pantry.validate({ count: 2, foodItemsRef: 'fi' });

    await pantry.apply(cfg, ctx);

    // Should NOT query foodItems collection
    const calledCollections = collectionSpy.mock.calls.map((c) => c[0] as string);
    expect(calledCollections).not.toContain('foodItems');
    expect(foodItemsFind).not.toHaveBeenCalled();

    // Should resolve 'fi'
    expect(ctx.resolve).toHaveBeenCalledWith('fi');

    // Should insert 2 pantry docs
    expect(pantryInsertOne).toHaveBeenCalledTimes(2);
  });

  it('uses the resolved foodItemIds as foodItemId on inserted docs', async () => {
    const foodId1 = makeFoodId();
    const foodId2 = makeFoodId();
    const { db, pantryInsertOne } = mockDb();
    const ctx = mockCtx(db, 'p', { Apples: foodId1, Bread: foodId2 });
    const cfg = pantry.validate({ count: 2, foodItemsRef: 'fi' });

    await pantry.apply(cfg, ctx);

    const insertedIds = pantryInsertOne.mock.calls.map(
      (c) => (c[0] as Record<string, unknown>).foodItemId as string
    );
    expect(insertedIds).toContain(foodId1.toString());
    expect(insertedIds).toContain(foodId2.toString());
  });
});

// ─── apply — without foodItemsRef ────────────────────────────────────────────

describe('pantry.apply — without foodItemsRef', () => {
  it('queries foodItems collection when foodItemsRef is not provided', async () => {
    const foodId = makeFoodId();
    const { db, foodItemsFind, pantryInsertOne } = mockDb({
      foodItemDocs: [{ _id: foodId }],
    });
    const ctx = mockCtx(db, 'p');
    const cfg = pantry.validate({ count: 1 });

    await pantry.apply(cfg, ctx);

    expect(foodItemsFind).toHaveBeenCalled();
    expect(pantryInsertOne).toHaveBeenCalledTimes(1);
  });

  it('passes count to limit() when querying foodItems', async () => {
    const { db, foodItemsLimit } = mockDb({
      foodItemDocs: [{ _id: makeFoodId() }, { _id: makeFoodId() }],
    });
    const ctx = mockCtx(db, 'p');
    const cfg = pantry.validate({ count: 2 });

    await pantry.apply(cfg, ctx);

    expect(foodItemsLimit).toHaveBeenCalledWith(2);
  });
});

// ─── apply — inserts with correct tags ───────────────────────────────────────

describe('pantry.apply — insertions', () => {
  it('inserts count docs into pantry with both _seed* tags', async () => {
    const foodId1 = makeFoodId();
    const foodId2 = makeFoodId();
    const { db, pantryInsertOne, collectionSpy } = mockDb();
    const ctx = mockCtx(db, 'p', { Apples: foodId1, Bread: foodId2 });
    const cfg = pantry.validate({ count: 2, foodItemsRef: 'fi' });

    await pantry.apply(cfg, ctx);

    expect(collectionSpy).toHaveBeenCalledWith('pantry');
    expect(pantryInsertOne).toHaveBeenCalledTimes(2);

    const doc = pantryInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('p');
    expect(doc.userId).toBe('u1');
    expect(typeof doc.foodItemId).toBe('string');
  });

  it('returns pantryItemIds in state', async () => {
    const foodId1 = makeFoodId();
    const foodId2 = makeFoodId();
    const { db } = mockDb();
    const ctx = mockCtx(db, 'p', { Apples: foodId1, Bread: foodId2 });
    const cfg = pantry.validate({ count: 2, foodItemsRef: 'fi' });

    const result = await pantry.apply(cfg, ctx);

    expect(result.state.pantryItemIds).toHaveLength(2);
    result.state.pantryItemIds.forEach((id: unknown) => expect(id).toBeInstanceOf(ObjectId));
  });

  it('resolves userId via ctx.resolve("u")', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db, 'p', { Apples: makeFoodId() });
    const cfg = pantry.validate({ count: 1, foodItemsRef: 'fi' });

    await pantry.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('u');
  });

  it('produces a non-empty summary string', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db, 'p', { Apples: makeFoodId() });
    const cfg = pantry.validate({ count: 1, foodItemsRef: 'fi' });

    const result = await pantry.apply(cfg, ctx);

    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

// ─── apply — insufficient foodItems error ────────────────────────────────────

describe('pantry.apply — insufficient food items', () => {
  it('throws a clear error when queried foodItems are fewer than count', async () => {
    const { db } = mockDb({ foodItemDocs: [{ _id: makeFoodId() }] });
    const ctx = mockCtx(db, 'p');
    const cfg = pantry.validate({ count: 3 });

    await expect(pantry.apply(cfg, ctx)).rejects.toThrow(
      /pantry: need 3 food items but only found 1/
    );
  });

  it('error message includes the count needed and count available', async () => {
    const { db } = mockDb({ foodItemDocs: [] });
    const ctx = mockCtx(db, 'p');
    const cfg = pantry.validate({ count: 2 });

    await expect(pantry.apply(cfg, ctx)).rejects.toThrow(/need 2.*found 0|found 0.*need 2/i);
  });

  it('throws when foodItemsRef provides fewer ids than count', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db, 'p', { Apples: makeFoodId() });
    const cfg = pantry.validate({ count: 3, foodItemsRef: 'fi' });

    await expect(pantry.apply(cfg, ctx)).rejects.toThrow(/pantry: need 3/);
  });
});

// ─── apply — idempotency ─────────────────────────────────────────────────────

describe('pantry.apply — idempotency', () => {
  it('does not re-insert when tagged pantry docs already exist', async () => {
    const { db, pantryInsertOne } = mockDb({ existingCount: 2 });
    const ctx = mockCtx(db, 'p', { Apples: makeFoodId(), Bread: makeFoodId() });
    const cfg = pantry.validate({ count: 2, foodItemsRef: 'fi' });

    const result = await pantry.apply(cfg, ctx);

    expect(pantryInsertOne).not.toHaveBeenCalled();
    expect(result.state.pantryItemIds).toHaveLength(2);
  });
});

// ─── clean ───────────────────────────────────────────────────────────────────

describe('pantry.clean', () => {
  it('calls deleteMany on pantry with tag filter', async () => {
    const { db, pantryDeleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await pantry.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('pantry');
    expect(pantryDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _seedManifestId: 'feat/test::default',
        _seedScenarioId: 'p',
      })
    );
  });

  it('returns docCount', async () => {
    const { db } = mockDb({ existingCount: 3 });
    const ctx = mockCtx(db);

    const result = await pantry.clean(ctx);

    expect(typeof result.docCount).toBe('number');
  });
});

// ─── block metadata ───────────────────────────────────────────────────────────

describe('pantry block metadata', () => {
  it('has name "pantry"', () => {
    expect(pantry.name).toBe('pantry');
  });

  it('declares collectionsWritten: ["pantry"]', () => {
    expect(pantry.documentation.collectionsWritten).toContain('pantry');
  });

  it('declares dependencies including "user-baseline"', () => {
    expect(pantry.documentation.dependencies).toContain('user-baseline');
  });

  it('documents the "u" id convention', () => {
    expect(pantry.documentation.description).toMatch(/"u"/);
  });
});
