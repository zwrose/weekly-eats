// test/manual/scenarios/__tests__/meal-plan-template.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

import { block as mealPlanTemplate } from '../meal-plan-template.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_CONFIG = {
  startDay: 'monday' as const,
  meals: { breakfast: true, lunch: true, dinner: true, staples: false },
};

function makeTemplateDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    userId: 'u1',
    startDay: 'monday',
    meals: { breakfast: true, lunch: true, dinner: true, staples: false },
    weeklyStaples: [],
    ...overrides,
  };
}

/**
 * Build a mock Db for mealPlanTemplates.
 *
 * findOneResult: what findOne returns (null = not found)
 * insertedId: the ObjectId returned from insertOne
 */
function mockDb(
  opts: {
    findOneResults?: (null | Record<string, unknown>)[];
    insertedId?: ObjectId;
    deletedCount?: number;
    countResult?: number;
  } = {}
) {
  const {
    findOneResults = [null, null],
    insertedId = new ObjectId(),
    deletedCount = 1,
    countResult = 0,
  } = opts;

  let findOneCallIndex = 0;
  const findOne = vi.fn(async () => {
    const result = findOneResults[findOneCallIndex] ?? null;
    findOneCallIndex++;
    return result;
  });

  const insertOne = vi.fn(async () => ({ insertedId }));
  const deleteMany = vi.fn(async () => ({ deletedCount }));
  const countDocuments = vi.fn(async () => countResult);

  const collectionSpy = vi.fn((_name: string) => ({
    findOne,
    insertOne,
    deleteMany,
    countDocuments,
  }));

  const db = { collection: collectionSpy } as unknown as import('mongodb').Db;
  return { db, findOne, insertOne, deleteMany, countDocuments, collectionSpy };
}

function mockCtx(db: import('mongodb').Db, scenarioId = 'mpt') {
  return {
    db,
    manifestId: 'feat/test::default',
    scenarioId,
    label: 'feat/te',
    resolve: vi.fn((id: string) => {
      if (id === 'u') return { userId: 'u1', email: 'test@example.com', name: 'Test User' };
      throw new Error(`unexpected resolve id: ${id}`);
    }),
  };
}

// ─── validate ───────────────────────────────────────────────────────────────

describe('mealPlanTemplate.validate', () => {
  it('accepts valid config', () => {
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);
    expect(cfg).toMatchObject(VALID_CONFIG);
  });

  it('accepts all days of the week', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      expect(() => mealPlanTemplate.validate({ ...VALID_CONFIG, startDay: day })).not.toThrow();
    }
  });

  it('accepts optional weeklyStaples', () => {
    const cfg = mealPlanTemplate.validate({
      ...VALID_CONFIG,
      weeklyStaples: [{ type: 'recipe', id: 'abc', name: 'Eggs' }],
    });
    expect(cfg.weeklyStaples).toHaveLength(1);
  });

  it('rejects invalid startDay', () => {
    expect(() => mealPlanTemplate.validate({ ...VALID_CONFIG, startDay: 'funday' })).toThrow();
  });

  it('rejects missing startDay', () => {
    const { startDay: _ignored, ...rest } = VALID_CONFIG;
    expect(() => mealPlanTemplate.validate(rest)).toThrow();
  });

  it('rejects missing meals', () => {
    expect(() => mealPlanTemplate.validate({ startDay: 'monday' })).toThrow();
  });

  it('rejects meals with wrong type', () => {
    expect(() =>
      mealPlanTemplate.validate({
        ...VALID_CONFIG,
        meals: { breakfast: 'yes', lunch: true, dinner: true, staples: false },
      })
    ).toThrow();
  });

  it('rejects meals with missing fields', () => {
    expect(() =>
      mealPlanTemplate.validate({
        ...VALID_CONFIG,
        meals: { breakfast: true, lunch: true },
      })
    ).toThrow();
  });
});

// ─── apply — fresh insert ─────────────────────────────────────────────────────

describe('mealPlanTemplate.apply — fresh insert', () => {
  it('inserts a template when none exists', async () => {
    const { db, insertOne } = mockDb({ findOneResults: [null, null] });
    const ctx = mockCtx(db);
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);

    const result = await mealPlanTemplate.apply(cfg, ctx);

    expect(insertOne).toHaveBeenCalledTimes(1);
    expect(result.state.templateId).toBeInstanceOf(ObjectId);
  });

  it('tags inserted doc with _seedManifestId and _seedScenarioId', async () => {
    const { db, insertOne } = mockDb({ findOneResults: [null, null] });
    const ctx = mockCtx(db);
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);

    await mealPlanTemplate.apply(cfg, ctx);

    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._seedManifestId).toBe('feat/test::default');
    expect(doc._seedScenarioId).toBe('mpt');
  });

  it('inserts correct startDay, meals, weeklyStaples, userId', async () => {
    const { db, insertOne } = mockDb({ findOneResults: [null, null] });
    const ctx = mockCtx(db);
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);

    await mealPlanTemplate.apply(cfg, ctx);

    const doc = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.startDay).toBe('monday');
    expect(doc.meals).toMatchObject({ breakfast: true, lunch: true, dinner: true, staples: false });
    expect(doc.weeklyStaples).toEqual([]);
    expect(doc.userId).toBe('u1');
  });

  it('resolves userId via ctx.resolve("u")', async () => {
    const { db } = mockDb({ findOneResults: [null, null] });
    const ctx = mockCtx(db);
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);

    await mealPlanTemplate.apply(cfg, ctx);

    expect(ctx.resolve).toHaveBeenCalledWith('u');
  });

  it('returns docCount=1 and a non-empty summary', async () => {
    const { db } = mockDb({ findOneResults: [null, null] });
    const ctx = mockCtx(db);
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);

    const result = await mealPlanTemplate.apply(cfg, ctx);

    expect(result.docCount).toBe(1);
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

// ─── apply — idempotency (tagged template exists) ─────────────────────────────

describe('mealPlanTemplate.apply — idempotency', () => {
  it('returns existing state without re-inserting when tagged template exists', async () => {
    const existingId = new ObjectId();
    const existingDoc = makeTemplateDoc({
      _seedManifestId: 'feat/test::default',
      _seedScenarioId: 'mpt',
    });
    existingDoc._id = existingId;
    const { db, insertOne } = mockDb({ findOneResults: [existingDoc] });
    const ctx = mockCtx(db);
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);

    const result = await mealPlanTemplate.apply(cfg, ctx);

    expect(insertOne).not.toHaveBeenCalled();
    expect(result.state.templateId.toString()).toBe(existingId.toString());
  });
});

// ─── apply — conflict: untagged template for same user ───────────────────────

describe('mealPlanTemplate.apply — untagged template conflict', () => {
  it('throws when an untagged template exists for this user', async () => {
    // First findOne (tagged) returns null, second findOne (untagged for user) returns a doc
    const untaggedDoc = makeTemplateDoc();
    const { db } = mockDb({ findOneResults: [null, untaggedDoc] });
    const ctx = mockCtx(db);
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);

    await expect(mealPlanTemplate.apply(cfg, ctx)).rejects.toThrow(
      /meal-plan-template.*already has a template/i
    );
  });

  it('error message mentions userId or email and hints at deletion', async () => {
    const untaggedDoc = makeTemplateDoc();
    const { db } = mockDb({ findOneResults: [null, untaggedDoc] });
    const ctx = mockCtx(db);
    const cfg = mealPlanTemplate.validate(VALID_CONFIG);

    let errorMessage = '';
    try {
      await mealPlanTemplate.apply(cfg, ctx);
    } catch (e) {
      errorMessage = (e as Error).message;
    }

    expect(errorMessage).toMatch(/u1|test@example\.com/);
    expect(errorMessage).toMatch(/delete|Delete/);
  });
});

// ─── clean ───────────────────────────────────────────────────────────────────

describe('mealPlanTemplate.clean', () => {
  it('calls deleteMany on mealPlanTemplates with tag filter', async () => {
    const { db, deleteMany, collectionSpy } = mockDb();
    const ctx = mockCtx(db);

    await mealPlanTemplate.clean(ctx);

    expect(collectionSpy).toHaveBeenCalledWith('mealPlanTemplates');
    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _seedManifestId: 'feat/test::default',
        _seedScenarioId: 'mpt',
      })
    );
  });

  it('returns docCount', async () => {
    const { db } = mockDb({ deletedCount: 1 });
    const ctx = mockCtx(db);

    const result = await mealPlanTemplate.clean(ctx);

    expect(result.docCount).toBeGreaterThanOrEqual(0);
  });
});

// ─── status ──────────────────────────────────────────────────────────────────

describe('mealPlanTemplate.status', () => {
  it('returns present=true when tagged template exists', async () => {
    const { db } = mockDb({ countResult: 1 });
    const ctx = mockCtx(db);

    const s = await mealPlanTemplate.status(ctx);

    expect(s.present).toBe(true);
    expect(s.docCount).toBe(1);
    expect(typeof s.configHashMatches).toBe('boolean');
  });

  it('returns present=false when no tagged template', async () => {
    const { db } = mockDb({ countResult: 0 });
    const ctx = mockCtx(db);

    const s = await mealPlanTemplate.status(ctx);

    expect(s.present).toBe(false);
    expect(s.docCount).toBe(0);
  });
});

// ─── block metadata ──────────────────────────────────────────────────────────

describe('mealPlanTemplate block metadata', () => {
  it('has name "meal-plan-template"', () => {
    expect(mealPlanTemplate.name).toBe('meal-plan-template');
  });

  it('declares collectionsWritten: ["mealPlanTemplates"]', () => {
    expect(mealPlanTemplate.documentation.collectionsWritten).toContain('mealPlanTemplates');
  });

  it('declares dependencies: ["user-baseline"]', () => {
    expect(mealPlanTemplate.documentation.dependencies).toContain('user-baseline');
  });

  it('documents the "u" id convention', () => {
    expect(mealPlanTemplate.documentation.description).toMatch(/"u"/);
  });

  it('mentions the unique userId index constraint', () => {
    expect(mealPlanTemplate.documentation.description).toMatch(/unique/i);
  });
});
