// test/manual/scenarios/recipes.ts
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';
import { seedTag, SEED_TITLE_PREFIX } from '../seedTag.js';

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  count: z.number().int().min(1),
  isGlobal: z.boolean(),
  withUserData: z.boolean().optional(),
  foodItemsRef: z.string().optional(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { recipeIds: ObjectId[] };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Inserts `count` recipes into the recipes collection. ' +
    'Depends on a user-baseline scenario — the manifest MUST give that scenario the id "u" ' +
    'so this block can call ctx.resolve("u") to obtain the userId. ' +
    'Optionally accepts `foodItemsRef` (the scenario id of a food-items block) to use real ' +
    'food item ObjectIds as ingredient ids; otherwise placeholder string ids are used. ' +
    'Set `withUserData: true` to also insert companion docs into recipeUserData.',
  configExamples: [
    { label: 'two user-scoped recipes', config: { count: 2, isGlobal: false } },
    {
      label: 'global recipes with food items',
      config: { count: 3, isGlobal: true, foodItemsRef: 'fi' },
    },
    {
      label: 'recipes with user data',
      config: { count: 2, isGlobal: false, withUserData: true, foodItemsRef: 'fi' },
    },
  ],
  dependencies: ['user-baseline'],
  collectionsWritten: ['recipes', 'recipeUserData'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Must be valid 24-char hex strings: with no foodItemsRef these land in ingredient.id, and the
// recipe-detail route (recipes/[id]/route.ts) calls ObjectId.createFromHexString(id) without an
// isValid guard — a non-hex value throws → HTTP 500. They won't resolve to real food items
// (ingredient name stays as stored), but they won't crash the detail route.
const PLACEHOLDER_IDS = [
  '000000000000000000000001',
  '000000000000000000000002',
  '000000000000000000000003',
];

function buildIngredients(
  index: number,
  foodItemValues: ObjectId[]
): Array<{
  ingredients: Array<{ type: 'foodItem'; id: string; quantity: number; unit: string }>;
}> {
  const pool = foodItemValues.length > 0 ? foodItemValues : PLACEHOLDER_IDS;
  // Each recipe gets 1-3 ingredients, cycled from the pool
  const ingredientCount = (index % 3) + 1;
  const ingredients = Array.from({ length: ingredientCount }, (_, j) => ({
    type: 'foodItem' as const,
    // Store the ingredient id as a hex STRING (how the app persists it). ObjectId values from
    // foodItemsRef must be coerced — the recipe-detail route does ObjectId.createFromHexString(id),
    // which throws (→ 500) on a BSON ObjectId. Real app recipes store the id as a string.
    id: String(pool[(index + j) % pool.length]),
    quantity: j + 1,
    unit: 'cup',
  }));
  return [{ ingredients }];
}

// ─── Block ───────────────────────────────────────────────────────────────────

export const block: Block<Config, State> = {
  name: 'recipes',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c);
  },

  async apply(config, ctx) {
    const { userId } = ctx.resolve<{ userId: string }>('u');

    // Resolve food item IDs if a reference is provided
    let foodItemValues: ObjectId[] = [];
    if (config.foodItemsRef) {
      const fiState = ctx.resolve<{ foodItemIds: Record<string, ObjectId> }>(config.foodItemsRef);
      foodItemValues = Object.values(fiState.foodItemIds);
    }

    const tagFilter = seedTag(ctx);

    const recipesCol = ctx.db.collection('recipes');

    // ── Idempotency: if tagged docs already exist, return their state ──
    const existing = await recipesCol.find(tagFilter).toArray();
    if (existing.length >= config.count) {
      return {
        state: { recipeIds: existing.map((d) => d._id as ObjectId) },
        docCount: existing.length,
        summary: `${existing.length} recipe${existing.length !== 1 ? 's' : ''} (already present)`,
      };
    }

    // ── Clean any partial state before fresh insert ──
    if (existing.length > 0) {
      await recipesCol.deleteMany(tagFilter);
    }

    const now = new Date();
    const recipeIds: ObjectId[] = [];
    let docCount = 0;

    // ── Insert recipes ──
    for (let i = 0; i < config.count; i++) {
      const result = await recipesCol.insertOne({
        title: `${SEED_TITLE_PREFIX}Recipe [${ctx.label}] ${i + 1}`,
        emoji: '🍝',
        ingredients: buildIngredients(i, foodItemValues),
        instructions: 'Step 1: Test.\nStep 2: Verify.',
        isGlobal: config.isGlobal,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        ...tagFilter,
      });
      recipeIds.push(result.insertedId as ObjectId);
      docCount += 1;
    }

    // ── Insert recipeUserData if requested ──
    if (config.withUserData) {
      const userDataCol = ctx.db.collection('recipeUserData');
      for (const recipeId of recipeIds) {
        await userDataCol.insertOne({
          userId,
          recipeId: recipeId.toString(),
          notes: 'Manual test note',
          ...tagFilter,
        });
        docCount += 1;
      }
    }

    const scope = config.isGlobal ? 'global' : 'user-scoped';
    return {
      state: { recipeIds },
      docCount,
      summary: `${config.count} recipe${config.count !== 1 ? 's' : ''} (${scope})`,
    };
  },

  async clean(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const [r1, r2] = await Promise.all([
      ctx.db.collection('recipes').deleteMany(tagFilter),
      ctx.db.collection('recipeUserData').deleteMany(tagFilter),
    ]);
    return { docCount: (r1.deletedCount ?? 0) + (r2.deletedCount ?? 0) };
  },

  async status(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const count = await ctx.db.collection('recipes').countDocuments(tagFilter);
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};
