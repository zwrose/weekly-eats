// test/manual/scenarios/__tests__/shopping-list.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

import { block as shoppingList } from '../shopping-list.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeId() {
  return new ObjectId();
}

/**
 * Build a mock Db.
 * `existingDocs` simulates tagged shoppingLists already in the DB.
 */
function mockDb(opts: { existingDocs?: Array<{ _id: ObjectId; storeId: string }> } = {}) {
  const { existingDocs = [] } = opts;

  const slInsertOne = vi.fn(async () => ({ insertedId: new ObjectId() }));
  const slDeleteMany = vi.fn(async () => ({ deletedCount: existingDocs.length }));
  const slCountDocuments = vi.fn(async () => existingDocs.length);

  const slToArray = vi.fn(async () => existingDocs);
  const slFind = vi.fn(() => ({ toArray: slToArray }));

  const collectionSpy = vi.fn((_name: string) => ({
    insertOne: slInsertOne,
    deleteMany: slDeleteMany,
    countDocuments: slCountDocuments,
    find: slFind,
  }));

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return { db, slInsertOne, slDeleteMany, slCountDocuments, slFind, slToArray, collectionSpy };
}

function makeStoreId() {
  return new ObjectId();
}

function mockCtx(
  db: import('mongodb').Db,
  scenarioId = 'sl',
  storeIds?: ObjectId[],
  foodItemIds?: ObjectId[]
) {
  const defaultStoreIds = [makeStoreId(), makeStoreId()];
  const defaultFoodIds = [makeId(), makeId(), makeId(), makeId()];
  const resolvedStoreIds = storeIds ?? defaultStoreIds;
  const resolvedFoodIds = foodItemIds ?? defaultFoodIds;

  return {
    db,
    manifestId: 'feat/test::default',
    scenarioId,
    label: 'fix/93-s',
    resolve: vi.fn((id: string) => {
      if (id === 'u') return { userId: 'u1', email: 'a@b.c', name: 'A' };
      if (id === 'st') return { storeIds: resolvedStoreIds };
      if (id === 'fi') return { foodItemIds: resolvedFoodIds };
      throw new Error(`unexpected resolve id: ${id}`);
    }),
  };
}

// ─── validate ────────────────────────────────────────────────────────────────

describe('shoppingList.validate', () => {
  it('accepts state="empty" with count=0', () => {
    const cfg = shoppingList.validate({ state: 'empty', itemCount: 0, storeRef: 'st' });
    expect(cfg).toMatchObject({ state: 'empty', itemCount: 0, storeRef: 'st' });
  });

  it('accepts state="partial" with count > 0', () => {
    const cfg = shoppingList.validate({ state: 'partial', itemCount: 4, storeRef: 'st' });
    expect(cfg).toMatchObject({ state: 'partial', itemCount: 4 });
  });

  it('accepts state="all-checked"', () => {
    const cfg = shoppingList.validate({ state: 'all-checked', itemCount: 2, storeRef: 'st' });
    expect(cfg).toMatchObject({ state: 'all-checked' });
  });

  it('rejects unknown state values', () => {
    expect(() =>
      shoppingList.validate({ state: 'half-done', itemCount: 2, storeRef: 'st' })
    ).toThrow();
  });

  it('rejects missing storeRef', () => {
    expect(() => shoppingList.validate({ state: 'empty', itemCount: 0 })).toThrow();
  });

  it('rejects negative itemCount', () => {
    expect(() =>
      shoppingList.validate({ state: 'empty', itemCount: -1, storeRef: 'st' })
    ).toThrow();
  });

  it('rejects fractional itemCount', () => {
    expect(() =>
      shoppingList.validate({ state: 'partial', itemCount: 2.5, storeRef: 'st' })
    ).toThrow();
  });

  it('accepts optional foodItemsRef', () => {
    const cfg = shoppingList.validate({
      state: 'all-checked',
      itemCount: 2,
      storeRef: 'st',
      foodItemsRef: 'fi',
    });
    expect(cfg).toMatchObject({ foodItemsRef: 'fi' });
  });
});

// ─── apply — state semantics ──────────────────────────────────────────────────

describe('shoppingList.apply — state=empty', () => {
  it('inserts a shopping list with 0 items regardless of itemCount', async () => {
    const { db, slInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = shoppingList.validate({ state: 'empty', itemCount: 5, storeRef: 'st' });

    await shoppingList.apply(cfg, ctx);

    expect(slInsertOne).toHaveBeenCalledTimes(1);
    const doc = slInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect((doc.items as unknown[]).length).toBe(0);
  });
});

describe('shoppingList.apply — state=partial', () => {
  it('marks first half checked=true, rest false', async () => {
    const { db, slInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = shoppingList.validate({
      state: 'partial',
      itemCount: 4,
      storeRef: 'st',
      foodItemsRef: 'fi',
    });

    await shoppingList.apply(cfg, ctx);

    const doc = slInsertOne.mock.calls[0][0] as Record<string, unknown>;
    const items = doc.items as Array<{ checked: boolean }>;
    expect(items).toHaveLength(4);
    // first half (2) checked=true
    expect(items[0].checked).toBe(true);
    expect(items[1].checked).toBe(true);
    // rest checked=false
    expect(items[2].checked).toBe(false);
    expect(items[3].checked).toBe(false);
  });

  it('handles itemCount=0 with state=partial gracefully (0 items)', async () => {
    const { db, slInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = shoppingList.validate({ state: 'partial', itemCount: 0, storeRef: 'st' });

    await shoppingList.apply(cfg, ctx);

    const doc = slInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect((doc.items as unknown[]).length).toBe(0);
  });

  it('handles odd itemCount — floor(n/2) checked', async () => {
    const { db, slInsertOne } = mockDb();
    const foodIds = [makeId(), makeId(), makeId()];
    const ctx = mockCtx(db, 'sl', undefined, foodIds);
    const cfg = shoppingList.validate({
      state: 'partial',
      itemCount: 3,
      storeRef: 'st',
      foodItemsRef: 'fi',
    });

    await shoppingList.apply(cfg, ctx);

    const doc = slInsertOne.mock.calls[0][0] as Record<string, unknown>;
    const items = doc.items as Array<{ checked: boolean }>;
    expect(items).toHaveLength(3);
    // floor(3/2) = 1 checked
    expect(items[0].checked).toBe(true);
    expect(items[1].checked).toBe(false);
    expect(items[2].checked).toBe(false);
  });
});

describe('shoppingList.apply — state=all-checked', () => {
  it('marks all items checked=true', async () => {
    const { db, slInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = shoppingList.validate({
      state: 'all-checked',
      itemCount: 3,
      storeRef: 'st',
      foodItemsRef: 'fi',
    });

    await shoppingList.apply(cfg, ctx);

    const doc = slInsertOne.mock.calls[0][0] as Record<string, unknown>;
    const items = doc.items as Array<{ checked: boolean }>;
    expect(items).toHaveLength(3);
    items.forEach((item) => expect(item.checked).toBe(true));
  });
});

// ─── apply — insertions and tags ──────────────────────────────────────────────

describe('shoppingList.apply — insertions', () => {
  it('inserts into shoppingLists collection', async () => {
    const { db, collectionSpy } = mockDb();
    const ctx = mockCtx(db);
    const cfg = shoppingList.validate({ state: 'empty', itemCount: 0, storeRef: 'st' });

    await shoppingList.apply(cfg, ctx);

    expect(collectionSpy).toHaveBeenCalledWith('shoppingLists');
  });

  it('tags inserted doc with both _seed* fields', async () => {
    const { db, slInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = shoppingList.validate({ state: 'empty', itemCount: 0, storeRef: 'st' });

    await shoppingList.apply(cfg, ctx);

    const doc = slInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('sl');
  });

  it('uses storeIds[0] from the storeRef state', async () => {
    const storeId = makeStoreId();
    const { db, slInsertOne } = mockDb();
    const ctx = mockCtx(db, 'sl', [storeId]);
    const cfg = shoppingList.validate({ state: 'empty', itemCount: 0, storeRef: 'st' });

    await shoppingList.apply(cfg, ctx);

    const doc = slInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.storeId).toBe(storeId.toString());
  });

  it('resolves userId via ctx.resolve("u")', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = shoppingList.validate({ state: 'empty', itemCount: 0, storeRef: 'st' });

    await shoppingList.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('u');
  });

  it('returns state with shoppingListId and itemCount', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = shoppingList.validate({
      state: 'all-checked',
      itemCount: 2,
      storeRef: 'st',
      foodItemsRef: 'fi',
    });

    const result = await shoppingList.apply(cfg, ctx);

    expect(result.state.shoppingListId).toBeInstanceOf(ObjectId);
    expect(result.state.itemCount).toBe(2);
  });
});

// ─── apply — idempotency ─────────────────────────────────────────────────────

describe('shoppingList.apply — idempotency', () => {
  it('does not re-insert when a tagged shopping list already exists for the store', async () => {
    const storeId = makeStoreId();
    const { db, slInsertOne } = mockDb({
      existingDocs: [{ _id: new ObjectId(), storeId: storeId.toString() }],
    });
    const ctx = mockCtx(db, 'sl', [storeId]);
    const cfg = shoppingList.validate({ state: 'empty', itemCount: 0, storeRef: 'st' });

    await shoppingList.apply(cfg, ctx);

    expect(slInsertOne).not.toHaveBeenCalled();
  });
});

// ─── clean ───────────────────────────────────────────────────────────────────

describe('shoppingList.clean', () => {
  it('calls deleteMany on shoppingLists with both tag fields', async () => {
    const { db, slDeleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await shoppingList.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('shoppingLists');
    expect(slDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _seedManifestId: 'feat/test::default',
        _seedScenarioId: 'sl',
      })
    );
  });

  it('returns docCount from deleteMany', async () => {
    const { db } = mockDb({ existingDocs: [{ _id: new ObjectId(), storeId: 's1' }] });
    const ctx = mockCtx(db);

    const result = await shoppingList.clean(ctx);

    expect(typeof result.docCount).toBe('number');
  });
});

// ─── block metadata ───────────────────────────────────────────────────────────

describe('shoppingList block metadata', () => {
  it('has name "shopping-list"', () => {
    expect(shoppingList.name).toBe('shopping-list');
  });

  it('declares collectionsWritten includes "shoppingLists"', () => {
    expect(shoppingList.documentation.collectionsWritten).toContain('shoppingLists');
  });

  it('declares dependencies including "user-baseline"', () => {
    expect(shoppingList.documentation.dependencies).toContain('user-baseline');
  });

  it('declares dependencies including "stores"', () => {
    expect(shoppingList.documentation.dependencies).toContain('stores');
  });
});
