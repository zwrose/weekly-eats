// test/manual/scenarios/food-items.ts
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

// ─── Canonical food name lookup ──────────────────────────────────────────────
// Keys are lowercase input names; values are the canonical singular/plural/unit.
const KNOWN_FOODS: Record<string, { singularName: string; pluralName: string; unit: string }> = {
  apple: { singularName: 'Apple', pluralName: 'Apples', unit: 'each' },
  bread: { singularName: 'Bread', pluralName: 'Bread', unit: 'loaf' },
  chicken: { singularName: 'Chicken Breast', pluralName: 'Chicken Breasts', unit: 'pound' },
  egg: { singularName: 'Egg', pluralName: 'Eggs', unit: 'each' },
  milk: { singularName: 'Milk', pluralName: 'Milk', unit: 'cup' },
  butter: { singularName: 'Butter', pluralName: 'Butter', unit: 'tablespoon' },
  onion: { singularName: 'Onion', pluralName: 'Onions', unit: 'each' },
  garlic: { singularName: 'Garlic', pluralName: 'Garlic', unit: 'clove' },
  tomato: { singularName: 'Tomato', pluralName: 'Tomatoes', unit: 'each' },
  spinach: { singularName: 'Spinach', pluralName: 'Spinach', unit: 'cup' },
};

function resolveFoodName(input: string): {
  singularName: string;
  pluralName: string;
  unit: string;
} {
  const canonical = KNOWN_FOODS[input.toLowerCase()];
  if (canonical) return canonical;
  return { singularName: input, pluralName: input + 's', unit: 'each' };
}

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  ensure: z.array(z.string()).optional(),
  globalCount: z.number().int().nonnegative().optional(),
  userCount: z.number().int().nonnegative().optional(),
  isApproved: z.boolean().optional().default(true),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { foodItemIds: Record<string, ObjectId> };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Ensures food items exist in the foodItems collection. Supports named items via `ensure`, ' +
    'plus generated global/user items via `globalCount`/`userCount`. ' +
    'Depends on a user-baseline scenario — the manifest MUST give that scenario the id "u" ' +
    'so this block can call ctx.resolve("u") to obtain the userId.',
  configExamples: [
    { label: 'ensure specific items', config: { ensure: ['apple', 'bread'] } },
    { label: 'generate global items', config: { globalCount: 5 } },
    { label: 'generate user-owned items', config: { userCount: 3 } },
    { label: 'mixed', config: { ensure: ['egg'], globalCount: 2, userCount: 1 } },
  ],
  dependencies: ['user-baseline'],
  collectionsWritten: ['foodItems'],
};

// ─── Block ───────────────────────────────────────────────────────────────────

export const block: Block<Config, State> = {
  name: 'food-items',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c ?? {});
  },

  async apply(config, ctx) {
    const userState = ctx.resolve<{ userId: string }>('u');
    const userId = userState.userId;
    const col = ctx.db.collection('foodItems');
    const now = new Date();
    const foodItemIds: Record<string, ObjectId> = {};
    let docCount = 0;

    // ── Helper: upsert one item ──
    async function upsertItem(
      singularName: string,
      pluralName: string,
      unit: string,
      isGlobal: boolean
    ) {
      const existing = await col.findOne({
        _seedManifestId: ctx.manifestId,
        _seedScenarioId: ctx.scenarioId,
        singularName,
      });
      if (existing) {
        foodItemIds[pluralName] = existing._id as ObjectId;
        docCount += 1;
        return;
      }
      const result = await col.insertOne({
        name: pluralName,
        singularName,
        pluralName,
        unit,
        isGlobal,
        isApproved: config.isApproved,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        _seedManifestId: ctx.manifestId,
        _seedScenarioId: ctx.scenarioId,
      });
      foodItemIds[pluralName] = result.insertedId as ObjectId;
      docCount += 1;
    }

    // ── ensure named items ──
    for (const name of config.ensure ?? []) {
      const { singularName, pluralName, unit } = resolveFoodName(name);
      await upsertItem(singularName, pluralName, unit, true);
    }

    // ── globalCount generated items ──
    const globalCount = config.globalCount ?? 0;
    for (let i = 1; i <= globalCount; i++) {
      const singularName = `Manual Test Food ${i}`;
      const pluralName = `Manual Test Food ${i}`;
      await upsertItem(singularName, pluralName, 'each', true);
    }

    // ── userCount generated items ──
    const userCount = config.userCount ?? 0;
    for (let i = 1; i <= userCount; i++) {
      const singularName = `Manual Test User Food ${i}`;
      const pluralName = `Manual Test User Food ${i}`;
      await upsertItem(singularName, pluralName, 'each', false);
    }

    const total = Object.keys(foodItemIds).length;
    return {
      state: { foodItemIds },
      docCount,
      summary: `${total} food item${total !== 1 ? 's' : ''}`,
    };
  },

  async clean(ctx) {
    const col = ctx.db.collection('foodItems');
    const result = await col.deleteMany({
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    });
    return { docCount: result.deletedCount ?? 0 };
  },

  async status(ctx) {
    const col = ctx.db.collection('foodItems');
    const count = await col.countDocuments({
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    });
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};

