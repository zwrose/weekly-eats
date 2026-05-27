// test/manual/scenarios/stores.ts
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  count: z.number().int().min(1),
  withPositions: z.boolean().optional(),
  foodItemsRef: z.string().optional(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { storeIds: ObjectId[]; positionsPerStore: number };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Inserts `count` stores into the stores collection. ' +
    'Depends on a user-baseline scenario — the manifest MUST give that scenario the id "u" ' +
    'so this block can call ctx.resolve("u") to obtain the userId. ' +
    'Set `withPositions: true` to also insert storeItemPositions for every (store, foodItem) pair; ' +
    'in that case `foodItemsRef` (the scenario id of a food-items block) is required. ' +
    'Advisory dependency on "food-items" when withPositions is used.',
  configExamples: [
    { label: 'two stores without positions', config: { count: 2 } },
    {
      label: 'three stores with item positions',
      config: { count: 3, withPositions: true, foodItemsRef: 'fi' },
    },
  ],
  dependencies: ['user-baseline'],
  collectionsWritten: ['stores', 'storeItemPositions'],
};

// ─── Block ───────────────────────────────────────────────────────────────────

const block: Block<Config, State> = {
  name: 'stores',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c);
  },

  async apply(config, ctx) {
    const { userId } = ctx.resolve<{ userId: string }>('u');

    // ── Validate withPositions requires foodItemsRef ──
    if (config.withPositions && !config.foodItemsRef) {
      throw new Error(
        'stores: withPositions=true requires foodItemsRef to be set so food item IDs can be resolved.'
      );
    }

    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };

    const storesCol = ctx.db.collection('stores');

    // ── Idempotency: return existing state if tagged docs already present ──
    const existing = await storesCol.find(tagFilter).toArray();
    if (existing.length >= config.count) {
      return {
        state: {
          storeIds: existing.map((d) => d._id as ObjectId),
          positionsPerStore: 0,
        },
        docCount: existing.length,
        summary: `${existing.length} store${existing.length !== 1 ? 's' : ''} (already present)`,
      };
    }

    const now = new Date();
    const storeIds: ObjectId[] = [];
    let docCount = 0;

    // ── Insert stores ──
    for (let i = 0; i < config.count; i++) {
      const result = await storesCol.insertOne({
        userId,
        name: `Manual Test Store ${i + 1}`,
        emoji: '🛒',
        createdAt: now,
        updatedAt: now,
        ...tagFilter,
      });
      storeIds.push(result.insertedId as ObjectId);
      docCount += 1;
    }

    // ── Insert storeItemPositions if requested ──
    let foodItemIds: ObjectId[] = [];
    if (config.withPositions) {
      const fiState = ctx.resolve<{ foodItemIds: Record<string, ObjectId> }>(config.foodItemsRef!);
      foodItemIds = Object.values(fiState.foodItemIds);

      const posCol = ctx.db.collection('storeItemPositions');
      const totalItems = foodItemIds.length;

      for (const storeId of storeIds) {
        for (let j = 0; j < foodItemIds.length; j++) {
          const foodItemId = foodItemIds[j];
          // Deterministic position spread 0..1
          const position = totalItems > 1 ? j / (totalItems - 1) : 0;
          await posCol.insertOne({
            storeId: storeId.toString(),
            foodItemId: foodItemId.toString(),
            position,
            updatedAt: now,
            ...tagFilter,
          });
          docCount += 1;
        }
      }
    }

    const positionsPerStore = config.withPositions ? foodItemIds.length : 0;
    const summary =
      `${config.count} store${config.count !== 1 ? 's' : ''}` +
      (config.withPositions ? ' with positions' : '');

    return {
      state: { storeIds, positionsPerStore },
      docCount,
      summary,
    };
  },

  async clean(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const [r1, r2] = await Promise.all([
      ctx.db.collection('stores').deleteMany(tagFilter),
      ctx.db.collection('storeItemPositions').deleteMany(tagFilter),
    ]);
    return { docCount: (r1.deletedCount ?? 0) + (r2.deletedCount ?? 0) };
  },

  async status(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const count = await ctx.db.collection('stores').countDocuments(tagFilter);
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};

export default block;
