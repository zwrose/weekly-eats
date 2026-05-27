// test/manual/scenarios/purchase-history.ts
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  count: z.number().int().min(1),
  daysBack: z.number().int().min(1).optional(),
  foodItemsRef: z.string().optional(),
  storeRef: z.string().optional(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { purchaseIds: ObjectId[] };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Inserts `count` purchase history records into the purchaseHistory collection. ' +
    'Each record represents a unique (storeId, foodItemId) pair — respecting the ' +
    'UNIQUE INDEX on purchaseHistory({ storeId, foodItemId }). ' +
    'Throws if count exceeds the number of available unique pairs. ' +
    '`daysBack` (default 30) controls how far back lastPurchasedAt is randomised. ' +
    'Optionally accepts `storeRef` and `foodItemsRef` to resolve IDs from other blocks; ' +
    'otherwise queries the stores/foodItems collections for the first available docs. ' +
    'Depends on a user-baseline scenario — the manifest MUST give that scenario the id "u".',
  configExamples: [
    {
      label: 'three purchases in last 30 days',
      config: { count: 3, storeRef: 'st', foodItemsRef: 'fi' },
    },
    {
      label: 'five purchases in last 60 days',
      config: { count: 5, daysBack: 60, storeRef: 'st', foodItemsRef: 'fi' },
    },
  ],
  dependencies: ['user-baseline', 'food-items', 'stores'],
  collectionsWritten: ['purchaseHistory'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomDateWithinDays(daysBack: number): Date {
  const now = Date.now();
  const msBack = daysBack * 24 * 60 * 60 * 1000;
  return new Date(now - Math.floor(Math.random() * msBack));
}

// ─── Block ───────────────────────────────────────────────────────────────────

const block: Block<Config, State> = {
  name: 'purchase-history',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c);
  },

  async apply(config, ctx) {
    const { userId } = ctx.resolve<{ userId: string }>('u');
    const daysBack = config.daysBack ?? 30;

    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };

    const phCol = ctx.db.collection('purchaseHistory');

    // ── Idempotency: return existing if tagged docs already present ──
    const existing = await phCol.find(tagFilter).toArray();
    if (existing.length >= config.count) {
      return {
        state: { purchaseIds: existing.map((d) => d._id as ObjectId) },
        docCount: existing.length,
        summary: `${existing.length} purchases over last ${daysBack} days (already present)`,
      };
    }

    // ── Resolve store IDs ──
    let storeIds: ObjectId[];
    if (config.storeRef) {
      storeIds = ctx.resolve<{ storeIds: ObjectId[] }>(config.storeRef).storeIds;
    } else {
      const docs = await ctx.db.collection('stores').find({}).limit(config.count).toArray();
      storeIds = docs.map((d) => d._id as ObjectId);
    }

    // ── Resolve food item IDs ──
    let foodItemIds: ObjectId[];
    if (config.foodItemsRef) {
      const fiState = ctx.resolve<{ foodItemIds: ObjectId[] | Record<string, ObjectId> }>(
        config.foodItemsRef
      );
      foodItemIds = Array.isArray(fiState.foodItemIds)
        ? fiState.foodItemIds
        : Object.values(fiState.foodItemIds as Record<string, ObjectId>);
    } else {
      const docs = await ctx.db.collection('foodItems').find({}).limit(config.count).toArray();
      foodItemIds = docs.map((d) => d._id as ObjectId);
    }

    // ── Validate enough pairs ──
    const maxPairs = storeIds.length * foodItemIds.length;
    if (config.count > maxPairs) {
      throw new Error(
        `purchase-history: count=${config.count} exceeds available unique (store, foodItem) pairs (${storeIds.length} stores × ${foodItemIds.length} foodItems = ${maxPairs}). ` +
          'Add more stores or food items, or reduce count.'
      );
    }

    // ── Generate unique pairs ──
    const pairs: Array<{ storeId: string; foodItemId: string }> = [];
    outer: for (const storeId of storeIds) {
      for (const foodItemId of foodItemIds) {
        pairs.push({ storeId: storeId.toString(), foodItemId: foodItemId.toString() });
        if (pairs.length === config.count) break outer;
      }
    }

    // ── Insert records ──
    const now = new Date();
    const purchaseIds: ObjectId[] = [];

    for (let i = 0; i < pairs.length; i++) {
      const { storeId, foodItemId } = pairs[i];
      const result = await phCol.insertOne({
        userId,
        storeId,
        foodItemId,
        name: `Manual Test Purchase ${i + 1}`,
        quantity: 1,
        unit: 'each',
        lastPurchasedAt: randomDateWithinDays(daysBack),
        createdAt: now,
        updatedAt: now,
        ...tagFilter,
      });
      purchaseIds.push(result.insertedId as ObjectId);
    }

    return {
      state: { purchaseIds },
      docCount: config.count,
      summary: `${config.count} purchases over last ${daysBack} days`,
    };
  },

  async clean(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const result = await ctx.db.collection('purchaseHistory').deleteMany(tagFilter);
    return { docCount: result.deletedCount ?? 0 };
  },

  async status(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const count = await ctx.db.collection('purchaseHistory').countDocuments(tagFilter);
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};

export default block;
