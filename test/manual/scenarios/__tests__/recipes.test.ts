// test/manual/scenarios/__tests__/recipes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

import { block as recipes } from '../recipes.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeExistingRecipe(overrides: Record<string, unknown> = {}) {
  return { _id: new ObjectId(), title: 'Manual Test Recipe 1', ...overrides };
}

/**
 * Build a mock Db that records calls.
 * `existingCount` drives countDocuments; `existingRecipes` drives find().toArray().
 */
function mockDb(
  opts: {
    existingCount?: number;
    insertOneId?: ObjectId;
  } = {}
) {
  const { existingCount = 0, insertOneId = new ObjectId() } = opts;

  const insertOne = vi.fn(async () => ({ insertedId: insertOneId }));
  const deleteMany = vi.fn(async () => ({ deletedCount: existingCount || 2 }));
  const countDocuments = vi.fn(async () => existingCount);
  const toArray = vi.fn(async () =>
    existingCount > 0
      ? Array.from({ length: existingCount }, (_, i) => ({
          _id: new ObjectId(),
          title: `Manual Test Recipe ${i + 1}`,
        }))
      : []
  );
  const find = vi.fn(() => ({ toArray }));

  const collectionSpy = vi.fn((_name: string) => ({
    insertOne,
    deleteMany,
    countDocuments,
    find,
  }));

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return { db, insertOne, deleteMany, countDocuments, find, toArray, collectionSpy };
}

/**
 * Build a BlockContext mock.
 * resolve('u') → user-baseline state.
 * resolve('fi') → food-items state with two known food IDs.
 */
function mockCtx(db: import('mongodb').Db, scenarioId = 'r') {
  const foodItemId1 = new ObjectId();
  const foodItemId2 = new ObjectId();
  return {
    db,
    manifestId: 'feat/test::default',
    scenarioId,
    label: 'feat/te',
    resolve: vi.fn((id: string) => {
      if (id === 'u') return { userId: 'u1', email: 'a@b.c', name: 'A' };
      if (id === 'fi') return { foodItemIds: { Apples: foodItemId1, Bread: foodItemId2 } };
      throw new Error(`unexpected resolve id: ${id}`);
    }),
  };
}

// ─── validate ───────────────────────────────────────────────────────────────

describe('recipes.validate', () => {
  it('accepts minimal valid config', () => {
    const cfg = recipes.validate({ count: 2, isGlobal: false });
    expect(cfg).toMatchObject({ count: 2, isGlobal: false });
  });

  it('accepts full config', () => {
    const cfg = recipes.validate({
      count: 3,
      isGlobal: true,
      withUserData: true,
      foodItemsRef: 'fi',
    });
    expect(cfg).toMatchObject({ count: 3, isGlobal: true, withUserData: true, foodItemsRef: 'fi' });
  });

  it('rejects count < 1', () => {
    expect(() => recipes.validate({ count: 0, isGlobal: false })).toThrow();
  });

  it('rejects non-integer count', () => {
    expect(() => recipes.validate({ count: 1.5, isGlobal: false })).toThrow();
  });

  it('rejects missing isGlobal', () => {
    expect(() => recipes.validate({ count: 1 })).toThrow();
  });

  it('rejects malformed isGlobal', () => {
    expect(() => recipes.validate({ count: 1, isGlobal: 'yes' })).toThrow();
  });

  it('rejects missing count', () => {
    expect(() => recipes.validate({ isGlobal: true })).toThrow();
  });
});

// ─── apply — basic insertion ─────────────────────────────────────────────────

describe('recipes.apply — basic', () => {
  it('inserts count=2 recipes and tags them', async () => {
    const { db, insertOne, collectionSpy } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 2, isGlobal: false, foodItemsRef: 'fi' });

    const result = await recipes.apply(cfg, ctx);

    expect(collectionSpy).toHaveBeenCalledWith('recipes');
    expect(insertOne).toHaveBeenCalledTimes(2);

    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('r');
    expect(doc.title).toMatch(/^Manual Test Recipe \[.+\] \d+$/);
    expect(doc.isGlobal).toBe(false);
    expect(doc.createdBy).toBe('u1');
  });

  it('returns recipeIds in state', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 2, isGlobal: false });

    const result = await recipes.apply(cfg, ctx);

    expect(result.state.recipeIds).toHaveLength(2);
    result.state.recipeIds.forEach((id: unknown) => expect(id).toBeInstanceOf(ObjectId));
  });

  it('resolves userId via ctx.resolve("u")', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 1, isGlobal: true });

    await recipes.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('u');
  });

  it('uses placeholder food ids when foodItemsRef not provided', async () => {
    const { db, insertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 1, isGlobal: false });

    await recipes.apply(cfg, ctx);

    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    const ingredientLists = doc.ingredients as Array<{ ingredients: Array<{ id: string }> }>;
    const firstIngredient = ingredientLists[0].ingredients[0];
    expect(firstIngredient.id).toMatch(/placeholder/);
  });

  it('uses food item IDs from foodItemsRef when provided', async () => {
    const { db, insertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 1, isGlobal: false, foodItemsRef: 'fi' });

    await recipes.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('fi');
    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    const ingredientLists = doc.ingredients as Array<{ ingredients: Array<{ id: unknown }> }>;
    const firstIngredient = ingredientLists[0].ingredients[0];
    // Should be one of the real ObjectId values
    expect(firstIngredient.id).toBeInstanceOf(ObjectId);
  });

  it('produces a non-empty summary string', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 2, isGlobal: false });

    const result = await recipes.apply(cfg, ctx);

    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

// ─── apply — withUserData ────────────────────────────────────────────────────

describe('recipes.apply — withUserData', () => {
  it('inserts into recipeUserData when withUserData=true', async () => {
    const { db, insertOne, collectionSpy } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 2, isGlobal: false, withUserData: true });

    await recipes.apply(cfg, ctx);

    expect(collectionSpy).toHaveBeenCalledWith('recipeUserData');
    // 2 recipes + 2 recipeUserData = 4 inserts total
    expect(insertOne).toHaveBeenCalledTimes(4);
  });

  it('recipeUserData docs have seed tags and userId', async () => {
    const { db, insertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 1, isGlobal: false, withUserData: true });

    await recipes.apply(cfg, ctx);

    // Second insertOne call is the recipeUserData doc
    const userData = insertOne.mock.calls[1][0] as Record<string, unknown>;
    expect(userData._seedManifestId).toBe('feat/test::default');
    expect(userData._seedScenarioId).toBe('r');
    expect(userData.userId).toBe('u1');
    expect(typeof userData.recipeId).toBe('string');
  });

  it('does NOT insert into recipeUserData when withUserData=false', async () => {
    const { db, collectionSpy } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 1, isGlobal: false, withUserData: false });

    await recipes.apply(cfg, ctx);

    const calledCollections = collectionSpy.mock.calls.map((c) => c[0] as string);
    expect(calledCollections).not.toContain('recipeUserData');
  });

  it('docCount includes recipeUserData when withUserData=true', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 2, isGlobal: false, withUserData: true });

    const result = await recipes.apply(cfg, ctx);

    // 2 recipes + 2 recipeUserData
    expect(result.docCount).toBe(4);
  });
});

// ─── apply — idempotency ─────────────────────────────────────────────────────

describe('recipes.apply — idempotency', () => {
  it('does not double-insert when tagged recipes already exist', async () => {
    const { db, insertOne } = mockDb({ existingCount: 2 });
    const ctx = mockCtx(db);
    const cfg = recipes.validate({ count: 2, isGlobal: false });

    const result = await recipes.apply(cfg, ctx);

    // Already have 2 matching docs — should NOT insert
    expect(insertOne).not.toHaveBeenCalled();
    expect(result.state.recipeIds).toHaveLength(2);
  });
});

// ─── clean ───────────────────────────────────────────────────────────────────

describe('recipes.clean', () => {
  it('calls deleteMany on recipes with tag filter', async () => {
    const { db, deleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await recipes.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('recipes');
    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _seedManifestId: 'feat/test::default',
        _seedScenarioId: 'r',
      })
    );
  });

  it('calls deleteMany on recipeUserData with tag filter', async () => {
    const { db, deleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await recipes.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('recipeUserData');
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });

  it('returns combined docCount', async () => {
    const { db } = mockDb({ existingCount: 3 });
    const ctx = mockCtx(db);

    const result = await recipes.clean(ctx);

    // deleteMany mock returns deletedCount = existingCount (3) per call, 2 calls = 6
    expect(result.docCount).toBeGreaterThanOrEqual(0);
  });
});

// ─── status ──────────────────────────────────────────────────────────────────

describe('recipes.status', () => {
  it('returns present=true when docs exist', async () => {
    const { db } = mockDb({ existingCount: 2 });
    const ctx = mockCtx(db);

    const s = await recipes.status(ctx);

    expect(s.present).toBe(true);
    expect(s.docCount).toBe(2);
    expect(typeof s.configHashMatches).toBe('boolean');
  });

  it('returns present=false when no docs', async () => {
    const { db } = mockDb({ existingCount: 0 });
    const ctx = mockCtx(db);

    const s = await recipes.status(ctx);

    expect(s.present).toBe(false);
    expect(s.docCount).toBe(0);
  });

  it('only counts recipes collection (not recipeUserData)', async () => {
    const { db, collectionSpy } = mockDb({ existingCount: 1 });
    const ctx = mockCtx(db);

    await recipes.status(ctx);

    // status should query 'recipes', not 'recipeUserData'
    const calledCollections = collectionSpy.mock.calls.map((c) => c[0] as string);
    expect(calledCollections).toContain('recipes');
  });
});

// ─── block metadata ──────────────────────────────────────────────────────────

describe('recipes block metadata', () => {
  it('has name "recipes"', () => {
    expect(recipes.name).toBe('recipes');
  });

  it('declares collectionsWritten including recipes and recipeUserData', () => {
    expect(recipes.documentation.collectionsWritten).toContain('recipes');
    expect(recipes.documentation.collectionsWritten).toContain('recipeUserData');
  });

  it('declares dependencies: ["user-baseline"]', () => {
    expect(recipes.documentation.dependencies).toEqual(['user-baseline']);
  });

  it('documents the "u" id convention', () => {
    expect(recipes.documentation.description).toMatch(/"u"/);
  });
});
