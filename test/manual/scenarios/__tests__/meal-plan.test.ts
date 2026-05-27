// test/manual/scenarios/__tests__/meal-plan.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

import mealPlan from '../meal-plan.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TEMPLATE_ID = new ObjectId();
const RECIPE_ID_1 = new ObjectId();
const RECIPE_ID_2 = new ObjectId();

const TEMPLATE_DOC = {
  _id: TEMPLATE_ID,
  userId: 'u1',
  startDay: 'monday',
  meals: { breakfast: true, lunch: false, dinner: true, staples: false },
  weeklyStaples: [],
};

const VALID_CONFIG = {
  weeksOut: 0,
  slotsFilled: 2,
  templateRef: 'mpt',
};

/**
 * Build a mock Db for both mealPlans and mealPlanTemplates.
 *
 * mealPlanFindOne: what findOne returns for mealPlans (idempotency check)
 * templateFindOne: what findOne returns for mealPlanTemplates (snapshot read)
 */
function mockDb(
  opts: {
    mealPlanFindOne?: null | Record<string, unknown>;
    templateFindOne?: null | Record<string, unknown>;
    mealPlanInsertedId?: ObjectId;
    deletedCount?: number;
    countResult?: number;
  } = {}
) {
  const {
    mealPlanFindOne = null,
    templateFindOne = TEMPLATE_DOC,
    mealPlanInsertedId = new ObjectId(),
    deletedCount = 1,
    countResult = 0,
  } = opts;

  const mealPlansFindOne = vi.fn(async () => mealPlanFindOne);
  const mealPlansInsertOne = vi.fn(async () => ({ insertedId: mealPlanInsertedId }));
  const mealPlansUpdateOne = vi.fn(async () => ({ modifiedCount: 1 }));
  const mealPlansDeleteMany = vi.fn(async () => ({ deletedCount }));
  const mealPlansCountDocuments = vi.fn(async () => countResult);

  const templatesFindOne = vi.fn(async () => templateFindOne);

  const collectionSpy = vi.fn((name: string) => {
    if (name === 'mealPlans') {
      return {
        findOne: mealPlansFindOne,
        insertOne: mealPlansInsertOne,
        updateOne: mealPlansUpdateOne,
        deleteMany: mealPlansDeleteMany,
        countDocuments: mealPlansCountDocuments,
      };
    }
    if (name === 'mealPlanTemplates') {
      return { findOne: templatesFindOne };
    }
    throw new Error(`unexpected collection: ${name}`);
  });

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return {
    db,
    mealPlansFindOne,
    mealPlansInsertOne,
    mealPlansUpdateOne,
    mealPlansDeleteMany,
    mealPlansCountDocuments,
    templatesFindOne,
    collectionSpy,
    mealPlanInsertedId,
  };
}

function mockCtx(db: import('mongodb').Db, scenarioId = 'mp') {
  return {
    db,
    manifestId: 'feat/test::default',
    scenarioId,
    resolve: vi.fn((id: string) => {
      if (id === 'u') return { userId: 'u1', email: 'test@example.com', name: 'Test User' };
      if (id === 'mpt') return { templateId: TEMPLATE_ID };
      if (id === 'r') return { recipeIds: [RECIPE_ID_1, RECIPE_ID_2] };
      throw new Error(`unexpected resolve id: ${id}`);
    }),
  };
}

// ─── validate ───────────────────────────────────────────────────────────────

describe('mealPlan.validate', () => {
  it('accepts minimal valid config', () => {
    const cfg = mealPlan.validate(VALID_CONFIG);
    expect(cfg).toMatchObject(VALID_CONFIG);
  });

  it('accepts config with recipesRef', () => {
    const cfg = mealPlan.validate({ ...VALID_CONFIG, recipesRef: 'r' });
    expect(cfg.recipesRef).toBe('r');
  });

  it('accepts weeksOut=0', () => {
    expect(() => mealPlan.validate({ ...VALID_CONFIG, weeksOut: 0 })).not.toThrow();
  });

  it('accepts slotsFilled=0', () => {
    expect(() => mealPlan.validate({ ...VALID_CONFIG, slotsFilled: 0 })).not.toThrow();
  });

  it('rejects missing templateRef', () => {
    const { templateRef: _ignored, ...rest } = VALID_CONFIG;
    expect(() => mealPlan.validate(rest)).toThrow();
  });

  it('rejects negative weeksOut', () => {
    expect(() => mealPlan.validate({ ...VALID_CONFIG, weeksOut: -1 })).toThrow();
  });

  it('rejects negative slotsFilled', () => {
    expect(() => mealPlan.validate({ ...VALID_CONFIG, slotsFilled: -1 })).toThrow();
  });

  it('rejects non-integer weeksOut', () => {
    expect(() => mealPlan.validate({ ...VALID_CONFIG, weeksOut: 1.5 })).toThrow();
  });

  it('rejects non-integer slotsFilled', () => {
    expect(() => mealPlan.validate({ ...VALID_CONFIG, slotsFilled: 2.5 })).toThrow();
  });

  it('rejects missing weeksOut', () => {
    const { weeksOut: _ignored, ...rest } = VALID_CONFIG;
    expect(() => mealPlan.validate(rest)).toThrow();
  });

  it('rejects missing slotsFilled', () => {
    const { slotsFilled: _ignored, ...rest } = VALID_CONFIG;
    expect(() => mealPlan.validate(rest)).toThrow();
  });
});

// ─── apply — fresh insert ─────────────────────────────────────────────────────

describe('mealPlan.apply — fresh insert', () => {
  it('reads the template from DB by templateId to build templateSnapshot', async () => {
    const { db, templatesFindOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate(VALID_CONFIG);

    await mealPlan.apply(cfg, ctx);

    expect(templatesFindOne).toHaveBeenCalledWith(expect.objectContaining({ _id: TEMPLATE_ID }));
  });

  it('inserts a meal plan with correct templateSnapshot from template doc', async () => {
    const { db, mealPlansInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate(VALID_CONFIG);

    await mealPlan.apply(cfg, ctx);

    const doc = mealPlansInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.templateSnapshot).toMatchObject({
      startDay: 'monday',
      meals: { breakfast: true, lunch: false, dinner: true, staples: false },
    });
  });

  it('tags inserted doc with _seedManifestId and _seedScenarioId', async () => {
    const { db, mealPlansInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate(VALID_CONFIG);

    await mealPlan.apply(cfg, ctx);

    const doc = mealPlansInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('mp');
  });

  it('inserts userId and templateId from resolved state', async () => {
    const { db, mealPlansInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate(VALID_CONFIG);

    await mealPlan.apply(cfg, ctx);

    const doc = mealPlansInsertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.userId).toBe('u1');
    expect(doc.templateId).toBe(TEMPLATE_ID.toString());
  });

  it('resolves templateRef from ctx', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate(VALID_CONFIG);

    await mealPlan.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('mpt');
  });

  it('returns state with mealPlanId as ObjectId', async () => {
    const insertedId = new ObjectId();
    const { db } = mockDb({ mealPlanInsertedId: insertedId });
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate(VALID_CONFIG);

    const result = await mealPlan.apply(cfg, ctx);

    expect(result.state.mealPlanId.toString()).toBe(insertedId.toString());
  });

  it('returns slotCount in state', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate({ ...VALID_CONFIG, slotsFilled: 2 });

    const result = await mealPlan.apply(cfg, ctx);

    expect(typeof result.state.slotCount).toBe('number');
    expect(result.state.slotCount).toBeGreaterThanOrEqual(0);
  });

  it('produces a non-empty summary string', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate(VALID_CONFIG);

    const result = await mealPlan.apply(cfg, ctx);

    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('calls updateOne after insert to patch items with mealPlanId', async () => {
    const { db, mealPlansUpdateOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate({ ...VALID_CONFIG, slotsFilled: 1 });

    await mealPlan.apply(cfg, ctx);

    expect(mealPlansUpdateOne).toHaveBeenCalledTimes(1);
  });
});

// ─── apply — items with recipesRef ───────────────────────────────────────────

describe('mealPlan.apply — with recipesRef', () => {
  it('resolves recipesRef from ctx', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate({ ...VALID_CONFIG, slotsFilled: 2, recipesRef: 'r' });

    await mealPlan.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('r');
  });

  it('populates items with recipe type when recipesRef provided', async () => {
    const { db, mealPlansInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate({ ...VALID_CONFIG, slotsFilled: 2, recipesRef: 'r' });

    await mealPlan.apply(cfg, ctx);

    const doc = mealPlansInsertOne.mock.calls[0][0] as Record<string, unknown>;
    const items = doc.items as Array<Record<string, unknown>>;
    if (items.length > 0) {
      const firstItemInSlot = (items[0].items as Array<Record<string, unknown>>)[0];
      expect(firstItemInSlot.type).toBe('recipe');
    }
  });
});

// ─── apply — items without recipesRef ────────────────────────────────────────

describe('mealPlan.apply — without recipesRef', () => {
  it('does not call resolve for recipesRef when not provided', async () => {
    const { db } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate({ ...VALID_CONFIG, slotsFilled: 1 });

    await mealPlan.apply(cfg, ctx);

    const calls = (ctx.resolve as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls).not.toContain('r');
  });

  it('items still have type recipe with placeholder id when no recipesRef', async () => {
    const { db, mealPlansInsertOne } = mockDb();
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate({ ...VALID_CONFIG, slotsFilled: 1 });

    await mealPlan.apply(cfg, ctx);

    const doc = mealPlansInsertOne.mock.calls[0][0] as Record<string, unknown>;
    const items = doc.items as Array<Record<string, unknown>>;
    if (items.length > 0) {
      const slotItems = items[0].items as Array<Record<string, unknown>>;
      expect(slotItems[0].type).toBe('recipe');
      expect(slotItems[0].id).toMatch(/placeholder/);
    }
  });
});

// ─── apply — idempotency ─────────────────────────────────────────────────────

describe('mealPlan.apply — idempotency', () => {
  it('returns existing state without re-inserting when tagged meal plan exists', async () => {
    const existingId = new ObjectId();
    const existingDoc = {
      _id: existingId,
      items: [],
      _seedManifestId: 'feat/test::default',
      _seedScenarioId: 'mp',
    };
    const { db, mealPlansInsertOne } = mockDb({ mealPlanFindOne: existingDoc });
    const ctx = mockCtx(db);
    const cfg = mealPlan.validate(VALID_CONFIG);

    const result = await mealPlan.apply(cfg, ctx);

    expect(mealPlansInsertOne).not.toHaveBeenCalled();
    expect(result.state.mealPlanId.toString()).toBe(existingId.toString());
  });
});

// ─── clean ───────────────────────────────────────────────────────────────────

describe('mealPlan.clean', () => {
  it('calls deleteMany on mealPlans with tag filter', async () => {
    const { db, mealPlansDeleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await mealPlan.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('mealPlans');
    expect(mealPlansDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _seedManifestId: 'feat/test::default',
        _seedScenarioId: 'mp',
      })
    );
  });

  it('returns docCount', async () => {
    const { db } = mockDb({ deletedCount: 1 });
    const ctx = mockCtx(db);

    const result = await mealPlan.clean(ctx);

    expect(result.docCount).toBeGreaterThanOrEqual(0);
  });
});

// ─── status ──────────────────────────────────────────────────────────────────

describe('mealPlan.status', () => {
  it('returns present=true when tagged meal plan exists', async () => {
    const { db } = mockDb({ countResult: 1 });
    const ctx = mockCtx(db);

    const s = await mealPlan.status(ctx);

    expect(s.present).toBe(true);
    expect(s.docCount).toBe(1);
    expect(typeof s.configHashMatches).toBe('boolean');
  });

  it('returns present=false when no tagged meal plan', async () => {
    const { db } = mockDb({ countResult: 0 });
    const ctx = mockCtx(db);

    const s = await mealPlan.status(ctx);

    expect(s.present).toBe(false);
    expect(s.docCount).toBe(0);
  });
});

// ─── block metadata ──────────────────────────────────────────────────────────

describe('mealPlan block metadata', () => {
  it('has name "meal-plan"', () => {
    expect(mealPlan.name).toBe('meal-plan');
  });

  it('declares collectionsWritten: ["mealPlans"]', () => {
    expect(mealPlan.documentation.collectionsWritten).toContain('mealPlans');
  });

  it('declares dependencies including user-baseline and meal-plan-template', () => {
    expect(mealPlan.documentation.dependencies).toContain('user-baseline');
    expect(mealPlan.documentation.dependencies).toContain('meal-plan-template');
  });

  it('documents the "u" id convention', () => {
    expect(mealPlan.documentation.description).toMatch(/"u"/);
  });

  it('documents templateRef requirement', () => {
    expect(mealPlan.documentation.description).toMatch(/templateRef/);
  });
});
