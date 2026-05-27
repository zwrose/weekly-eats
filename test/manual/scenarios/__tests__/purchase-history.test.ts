// test/manual/scenarios/__tests__/purchase-history.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';

import purchaseHistory from '../purchase-history.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeId() {
  return new ObjectId();
}

function mockDb(opts: { existingDocs?: Array<{ _id: ObjectId }> } = {}) {
  const { existingDocs = [] } = opts;

  const phInsertOne = vi.fn(async () => ({ insertedId: new ObjectId() }));
  const phDeleteMany = vi.fn(async () => ({ deletedCount: existingDocs.length }));
  const phCountDocuments = vi.fn(async () => existingDocs.length);

  const phToArray = vi.fn(async () => existingDocs);
  const phFind = vi.fn(() => ({ toArray: phToArray }));

  const collectionSpy = vi.fn((_name: string) => ({
    insertOne: phInsertOne,
    deleteMany: phDeleteMany,
    countDocuments: phCountDocuments,
    find: phFind,
  }));

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return { db, phInsertOne, phDeleteMany, phCountDocuments, phFind, phToArray, collectionSpy };
}

function mockCtx(
  db: import('mongodb').Db,
  scenarioId = 'ph',
  storeIds?: ObjectId[],
  foodItemIds?: ObjectId[]
) {
  const defaultStoreIds = [makeId(), makeId()];
  const defaultFoodIds = [makeId(), makeId(), makeId()];
  const resolvedStoreIds = storeIds ?? defaultStoreIds;
  const resolvedFoodIds = foodItemIds ?? defaultFoodIds;

  return {
    db,
    manifestId: 'feat/test::default',
    scenarioId,
    resolve: vi.fn((id: string) => {
      if (id === 'u') return { userId: 'u1', email: 'a@b.c', name: 'A' };
      if (id === 'st') return { storeIds: resolvedStoreIds };
      if (id === 'fi') return { foodItemIds: resolvedFoodIds };
      throw new Error(`unexpected resolve id: ${id}`);
    }),
  };
}

// ─── validate ────────────────────────────────────────────────────────────────

describe('purchaseHistory.validate', () => {
  it('accepts minimal config with count', () => {
    const cfg = purchaseHistory.validate({ count: 3 });
    expect(cfg).toMatchObject({ count: 3 });
  });

  it('accepts count with daysBack', () => {
    const cfg = purchaseHistory.validate({ count: 2, daysBack: 60 });
    expect(cfg).toMatchObject({ count: 2, daysBack: 60 });
  });

  it('accepts optional storeRef and foodItemsRef', () => {
    const cfg = purchaseHistory.validate({
      count: 1,
      storeRef: 'st',
      foodItemsRef: 'fi',
    });
    expect(cfg).toMatchObject({ storeRef: 'st', foodItemsRef: 'fi' });
  });

  it('rejects count < 1', () => {
    expect(() => purchaseHistory.validate({ count: 0 })).toThrow();
  });

  it('rejects fractional count', () => {
    expect(() => purchaseHistory.validate({ count: 1.5 })).toThrow();
  });

  it('rejects daysBack < 1', () => {
    expect(() => purchaseHistory.validate({ count: 1, daysBack: 0 })).toThrow();
  });

  it('rejects missing count', () => {
    expect(() => purchaseHistory.validate({})).toThrow();
  });
});

// ─── apply — daysBack semantics ───────────────────────────────────────────────

describe('purchaseHistory.apply — daysBack', () => {
  it('defaults daysBack to 30 when not specified', async () => {
    const storeIds = [makeId()];
    const foodIds = [makeId()];
    const { db, phInsertOne } = mockDb();
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    const cfg = purchaseHistory.validate({ count: 1, storeRef: 'st', foodItemsRef: 'fi' });

    await purchaseHistory.apply(cfg, ctx);

    const doc = phInsertOne.mock.calls[0][0] as Record<string, unknown>;
    const purchasedAt = doc.lastPurchasedAt as Date;
    const now = new Date();
    const diffMs = now.getTime() - purchasedAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThanOrEqual(30);
  });

  it('respects explicit daysBack value', async () => {
    const storeIds = [makeId()];
    const foodIds = [makeId()];
    const { db, phInsertOne } = mockDb();
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    const cfg = purchaseHistory.validate({
      count: 1,
      daysBack: 90,
      storeRef: 'st',
      foodItemsRef: 'fi',
    });

    await purchaseHistory.apply(cfg, ctx);

    const doc = phInsertOne.mock.calls[0][0] as Record<string, unknown>;
    const purchasedAt = doc.lastPurchasedAt as Date;
    const now = new Date();
    const diffDays = (now.getTime() - purchasedAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThanOrEqual(90);
  });

  it('summary includes daysBack value', async () => {
    const storeIds = [makeId()];
    const foodIds = [makeId()];
    const { db } = mockDb();
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    const cfg = purchaseHistory.validate({
      count: 1,
      daysBack: 14,
      storeRef: 'st',
      foodItemsRef: 'fi',
    });

    const result = await purchaseHistory.apply(cfg, ctx);

    expect(result.summary).toMatch(/14/);
  });
});

// ─── apply — unique pairs ─────────────────────────────────────────────────────

describe('purchaseHistory.apply — unique (store, food) pairs', () => {
  it('inserts count docs with unique storeId+foodItemId pairs', async () => {
    const storeIds = [makeId(), makeId()];
    const foodIds = [makeId(), makeId(), makeId()];
    const { db, phInsertOne } = mockDb();
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    const cfg = purchaseHistory.validate({ count: 4, storeRef: 'st', foodItemsRef: 'fi' });

    await purchaseHistory.apply(cfg, ctx);

    expect(phInsertOne).toHaveBeenCalledTimes(4);

    const pairs = phInsertOne.mock.calls.map((c) => {
      const doc = c[0] as Record<string, unknown>;
      return `${doc.storeId}::${doc.foodItemId}`;
    });
    const uniquePairs = new Set(pairs);
    expect(uniquePairs.size).toBe(4);
  });

  it('throws when count exceeds available unique pairs', async () => {
    const storeIds = [makeId()];
    const foodIds = [makeId()];
    const { db } = mockDb();
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    // 1 store * 1 food = 1 unique pair, but count=2
    const cfg = purchaseHistory.validate({ count: 2, storeRef: 'st', foodItemsRef: 'fi' });

    await expect(purchaseHistory.apply(cfg, ctx)).rejects.toThrow();
  });
});

// ─── apply — tags ─────────────────────────────────────────────────────────────

describe('purchaseHistory.apply — insertions', () => {
  it('inserts into purchaseHistory collection', async () => {
    const storeIds = [makeId()];
    const foodIds = [makeId()];
    const { db, collectionSpy } = mockDb();
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    const cfg = purchaseHistory.validate({ count: 1, storeRef: 'st', foodItemsRef: 'fi' });

    await purchaseHistory.apply(cfg, ctx);

    expect(collectionSpy).toHaveBeenCalledWith('purchaseHistory');
  });

  it('tags each doc with both _seed* fields', async () => {
    const storeIds = [makeId()];
    const foodIds = [makeId()];
    const { db, phInsertOne } = mockDb();
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    const cfg = purchaseHistory.validate({ count: 1, storeRef: 'st', foodItemsRef: 'fi' });

    await purchaseHistory.apply(cfg, ctx);

    const doc = phInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('ph');
  });

  it('returns purchaseIds array in state', async () => {
    const storeIds = [makeId(), makeId()];
    const foodIds = [makeId(), makeId()];
    const { db } = mockDb();
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    const cfg = purchaseHistory.validate({ count: 2, storeRef: 'st', foodItemsRef: 'fi' });

    const result = await purchaseHistory.apply(cfg, ctx);

    expect(result.state.purchaseIds).toHaveLength(2);
    result.state.purchaseIds.forEach((id: unknown) => expect(id).toBeInstanceOf(ObjectId));
  });
});

// ─── apply — idempotency ─────────────────────────────────────────────────────

describe('purchaseHistory.apply — idempotency', () => {
  it('does not re-insert when tagged docs already exist', async () => {
    const existing = [{ _id: new ObjectId() }, { _id: new ObjectId() }];
    const { db, phInsertOne } = mockDb({ existingDocs: existing });
    const storeIds = [makeId(), makeId()];
    const foodIds = [makeId(), makeId()];
    const ctx = mockCtx(db, 'ph', storeIds, foodIds);
    const cfg = purchaseHistory.validate({ count: 2, storeRef: 'st', foodItemsRef: 'fi' });

    const result = await purchaseHistory.apply(cfg, ctx);

    expect(phInsertOne).not.toHaveBeenCalled();
    expect(result.state.purchaseIds).toHaveLength(2);
  });
});

// ─── clean ───────────────────────────────────────────────────────────────────

describe('purchaseHistory.clean', () => {
  it('calls deleteMany on purchaseHistory with both tag fields', async () => {
    const { db, phDeleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await purchaseHistory.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('purchaseHistory');
    expect(phDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _seedManifestId: 'feat/test::default',
        _seedScenarioId: 'ph',
      })
    );
  });

  it('returns docCount', async () => {
    const { db } = mockDb({ existingDocs: [{ _id: new ObjectId() }] });
    const ctx = mockCtx(db);

    const result = await purchaseHistory.clean(ctx);

    expect(typeof result.docCount).toBe('number');
  });
});

// ─── block metadata ───────────────────────────────────────────────────────────

describe('purchaseHistory block metadata', () => {
  it('has name "purchase-history"', () => {
    expect(purchaseHistory.name).toBe('purchase-history');
  });

  it('declares collectionsWritten includes "purchaseHistory"', () => {
    expect(purchaseHistory.documentation.collectionsWritten).toContain('purchaseHistory');
  });

  it('declares dependencies including "user-baseline"', () => {
    expect(purchaseHistory.documentation.dependencies).toContain('user-baseline');
  });
});
