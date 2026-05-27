// test/manual/scenarios/pantry.ts
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  count: z.number().int().min(1),
  foodItemsRef: z.string().optional(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { pantryItemIds: ObjectId[] };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Inserts `count` pantry items into the pantry collection, one per unique food item. ' +
    'Depends on a user-baseline scenario — the manifest MUST give that scenario the id "u" ' +
    'so this block can call ctx.resolve("u") to obtain the userId. ' +
    'Optionally accepts `foodItemsRef` (the scenario id of a food-items block) to use its ' +
    'foodItemIds directly; otherwise queries the foodItems collection for the first `count` items. ' +
    'Respects the UNIQUE INDEX on pantry({ userId, foodItemId }) by using one distinct foodItem per slot.',
  configExamples: [
    {
      label: 'three pantry items using food-items block',
      config: { count: 3, foodItemsRef: 'fi' },
    },
    { label: 'two pantry items from DB query', config: { count: 2 } },
  ],
  dependencies: ['user-baseline', 'food-items'],
  collectionsWritten: ['pantry'],
};

// ─── Block ───────────────────────────────────────────────────────────────────

const block: Block<Config, State> = {
  name: 'pantry',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c);
  },

  async apply(config, ctx) {
    const { userId } = ctx.resolve<{ userId: string }>('u');

    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };

    const pantryCol = ctx.db.collection('pantry');

    // ── Idempotency: return existing state if all tagged docs already present ──
    const existing = await pantryCol.find(tagFilter).toArray();
    if (existing.length >= config.count) {
      return {
        state: { pantryItemIds: existing.map((d) => d._id as ObjectId) },
        docCount: existing.length,
        summary: `${existing.length} pantry item${existing.length !== 1 ? 's' : ''} (already present)`,
      };
    }

    // ── Resolve food item IDs ──
    let foodItemIds: ObjectId[];

    if (config.foodItemsRef) {
      const fiState = ctx.resolve<{ foodItemIds: Record<string, ObjectId> }>(config.foodItemsRef);
      foodItemIds = Object.values(fiState.foodItemIds);
    } else {
      const docs = await ctx.db.collection('foodItems').find({}).limit(config.count).toArray();
      foodItemIds = docs.map((d) => d._id as ObjectId);
    }

    // ── Validate sufficient food items ──
    if (foodItemIds.length < config.count) {
      throw new Error(
        `pantry: need ${config.count} food items but only found ${foodItemIds.length}. ` +
          `Add a food-items block with at least ${config.count} items.`
      );
    }

    // ── Insert pantry items (one per unique foodItemId) ──
    const now = new Date();
    const pantryItemIds: ObjectId[] = [];

    for (let i = 0; i < config.count; i++) {
      const foodItemId = foodItemIds[i];
      const result = await pantryCol.insertOne({
        userId,
        foodItemId: foodItemId.toString(),
        createdAt: now,
        updatedAt: now,
        ...tagFilter,
      });
      pantryItemIds.push(result.insertedId as ObjectId);
    }

    return {
      state: { pantryItemIds },
      docCount: config.count,
      summary: `${config.count} pantry item${config.count !== 1 ? 's' : ''}`,
    };
  },

  async clean(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const result = await ctx.db.collection('pantry').deleteMany(tagFilter);
    return { docCount: result.deletedCount ?? 0 };
  },

  async status(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const count = await ctx.db.collection('pantry').countDocuments(tagFilter);
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};

export default block;
