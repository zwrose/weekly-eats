// test/manual/scenarios/shopping-list.ts
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  state: z.enum(['empty', 'partial', 'all-checked']),
  itemCount: z.number().int().min(0),
  storeRef: z.string(),
  foodItemsRef: z.string().optional(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { shoppingListId: ObjectId; itemCount: number };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Inserts one shopping list into the shoppingLists collection for the FIRST store ' +
    'in the storeRef state. ' +
    'Depends on a user-baseline scenario — the manifest MUST give that scenario the id "u". ' +
    'Depends on a stores block (storeRef is required). ' +
    'Optionally accepts foodItemsRef to resolve food item IDs; otherwise queries the ' +
    'foodItems collection for the first itemCount items. ' +
    'state="empty" produces 0 items. ' +
    'state="partial" produces itemCount items with the first floor(itemCount/2) checked=true. ' +
    'state="all-checked" produces itemCount items all checked=true. ' +
    'Respects the UNIQUE INDEX on shoppingLists({ storeId }) — one list per store.',
  configExamples: [
    { label: 'empty list', config: { state: 'empty', itemCount: 0, storeRef: 'st' } },
    {
      label: 'partial list with food items',
      config: { state: 'partial', itemCount: 4, storeRef: 'st', foodItemsRef: 'fi' },
    },
    {
      label: 'fully checked list',
      config: { state: 'all-checked', itemCount: 3, storeRef: 'st', foodItemsRef: 'fi' },
    },
  ],
  dependencies: ['user-baseline', 'stores', 'food-items'],
  collectionsWritten: ['shoppingLists'],
};

// ─── Block ───────────────────────────────────────────────────────────────────

export const block: Block<Config, State> = {
  name: 'shopping-list',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c);
  },

  async apply(config, ctx) {
    const { userId } = ctx.resolve<{ userId: string }>('u');
    const storesState = ctx.resolve<{ storeIds: ObjectId[] }>(config.storeRef);
    const storeId = storesState.storeIds[0].toString();

    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };

    const slCol = ctx.db.collection('shoppingLists');

    // ── Idempotency: return existing if tagged list already present ──
    const existing = await slCol.find(tagFilter).toArray();
    if (existing.length > 0) {
      const doc = existing[0];
      return {
        state: {
          shoppingListId: doc._id as ObjectId,
          itemCount: (doc.items as unknown[])?.length ?? 0,
        },
        docCount: 1,
        summary: `shopping list (${config.state}, ${(doc.items as unknown[])?.length ?? 0} items) (already present)`,
      };
    }

    // ── Resolve food item IDs ──
    let foodItemIds: ObjectId[] = [];
    if (config.state !== 'empty' && config.itemCount > 0) {
      if (config.foodItemsRef) {
        const fiState = ctx.resolve<{ foodItemIds: ObjectId[] }>(config.foodItemsRef);
        foodItemIds = Array.isArray(fiState.foodItemIds)
          ? fiState.foodItemIds
          : Object.values(fiState.foodItemIds as Record<string, ObjectId>);
      } else {
        const docs = await ctx.db
          .collection('foodItems')
          .find({})
          .limit(config.itemCount)
          .toArray();
        foodItemIds = docs.map((d) => d._id as ObjectId);
      }
    }

    // ── Build items array based on state ──
    let items: Array<{
      foodItemId: string;
      name: string;
      quantity: number;
      unit: string;
      checked: boolean;
    }> = [];

    if (config.state === 'empty') {
      items = [];
    } else {
      const count = Math.min(config.itemCount, foodItemIds.length);
      const checkedCount = config.state === 'all-checked' ? count : Math.floor(count / 2);

      items = Array.from({ length: count }, (_, i) => ({
        foodItemId: foodItemIds[i]?.toString() ?? `placeholder-${i}`,
        name: `Manual Test Item ${i + 1}`,
        quantity: 1,
        unit: 'each',
        checked: i < checkedCount,
      }));
    }

    // ── Insert ──
    const now = new Date();
    const result = await slCol.insertOne({
      storeId,
      userId,
      items,
      createdAt: now,
      updatedAt: now,
      ...tagFilter,
    });

    return {
      state: { shoppingListId: result.insertedId as ObjectId, itemCount: items.length },
      docCount: 1,
      summary: `shopping list (${config.state}, ${items.length} items)`,
    };
  },

  async clean(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const result = await ctx.db.collection('shoppingLists').deleteMany(tagFilter);
    return { docCount: result.deletedCount ?? 0 };
  },

  async status(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const count = await ctx.db.collection('shoppingLists').countDocuments(tagFilter);
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};

