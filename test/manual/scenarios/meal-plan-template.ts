// test/manual/scenarios/meal-plan-template.ts
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  startDay: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  meals: z.object({
    breakfast: z.boolean(),
    lunch: z.boolean(),
    dinner: z.boolean(),
    staples: z.boolean(),
  }),
  weeklyStaples: z.array(z.any()).optional(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { templateId: ObjectId };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Inserts a meal plan template into the mealPlanTemplates collection. ' +
    'Depends on a user-baseline scenario — the manifest MUST give that scenario the id "u" ' +
    'so this block can call ctx.resolve("u") to obtain the userId. ' +
    'IMPORTANT: mealPlanTemplates has a unique index on userId — at most one template per user. ' +
    'If a tagged template already exists (same manifest+scenario), it is returned as-is (idempotent). ' +
    'If an untagged template exists for this user, an error is thrown — delete it or use a ' +
    'different user via user-baseline config.email.',
  configExamples: [
    {
      label: 'monday start, breakfast+dinner only',
      config: {
        startDay: 'monday',
        meals: { breakfast: true, lunch: false, dinner: true, staples: false },
      },
    },
    {
      label: 'sunday start, all meal types',
      config: {
        startDay: 'sunday',
        meals: { breakfast: true, lunch: true, dinner: true, staples: true },
        weeklyStaples: [],
      },
    },
  ],
  dependencies: ['user-baseline'],
  collectionsWritten: ['mealPlanTemplates'],
};

// ─── Block ───────────────────────────────────────────────────────────────────

const block: Block<Config, State> = {
  name: 'meal-plan-template',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c);
  },

  async apply(config, ctx) {
    const { userId, email } = ctx.resolve<{ userId: string; email: string }>('u');

    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };

    const col = ctx.db.collection('mealPlanTemplates');

    // ── Idempotency: if a tagged doc already exists, return its state ──
    const existing = await col.findOne(tagFilter);
    if (existing) {
      return {
        state: { templateId: existing._id as ObjectId },
        docCount: 1,
        summary: 'meal plan template (already present)',
      };
    }

    // ── Conflict check: untagged template for this user ──
    const untagged = await col.findOne({
      userId,
      _seedManifestId: { $exists: false },
    });
    if (untagged) {
      throw new Error(
        `meal-plan-template: user ${email ?? userId} already has a template (non-manual-test). ` +
          `The mealPlanTemplates collection has a unique index on userId — seeding would fail. ` +
          `Delete the existing template or use a different user.`
      );
    }

    // ── Insert ──
    const now = new Date();
    const result = await col.insertOne({
      userId,
      startDay: config.startDay,
      meals: config.meals,
      weeklyStaples: config.weeklyStaples ?? [],
      createdAt: now,
      updatedAt: now,
      ...tagFilter,
    });

    return {
      state: { templateId: result.insertedId as ObjectId },
      docCount: 1,
      summary: `meal plan template (startDay: ${config.startDay})`,
    };
  },

  async clean(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const r = await ctx.db.collection('mealPlanTemplates').deleteMany(tagFilter);
    return { docCount: r.deletedCount ?? 0 };
  },

  async status(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const count = await ctx.db.collection('mealPlanTemplates').countDocuments(tagFilter);
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};

export default block;
