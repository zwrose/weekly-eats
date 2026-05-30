// test/manual/scenarios/meal-plan.ts
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';
import { seedTag, SEED_TITLE_PREFIX } from '../seedTag.js';

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  weeksOut: z.number().int().min(0),
  slotsFilled: z.number().int().min(0),
  recipesRef: z.string().optional(),
  templateRef: z.string(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { mealPlanId: ObjectId; slotCount: number };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Inserts a meal plan into the mealPlans collection. ' +
    'Depends on a user-baseline scenario — the manifest MUST give that scenario the id "u" ' +
    'so this block can call ctx.resolve("u") to obtain the userId. ' +
    'Requires templateRef (the scenario id of a meal-plan-template block) to build the ' +
    'templateSnapshot and determine which meal types to fill. ' +
    'Optionally accepts recipesRef (scenario id of a recipes block) to use real recipe ids ' +
    'in generated slot items; otherwise placeholder ids are used. ' +
    'weeksOut=0 means the current week; each additional week adds 7 days to the start date. ' +
    'slotsFilled controls how many MealPlanItem slots are generated, cycling through ' +
    'days and enabled meal types from the template.',
  configExamples: [
    {
      label: 'current week, 4 slots, no recipes',
      config: { weeksOut: 0, slotsFilled: 4, templateRef: 'mpt' },
    },
    {
      label: 'next week, 6 slots with recipes',
      config: { weeksOut: 1, slotsFilled: 6, templateRef: 'mpt', recipesRef: 'r' },
    },
  ],
  dependencies: ['user-baseline', 'meal-plan-template'],
  collectionsWritten: ['mealPlans'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'staples';

const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'staples'];

const PLACEHOLDER_RECIPE_ID = 'placeholder-recipe-1';

/** Return a YYYY-MM-DD string from a Date */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Given a startDay name, return the next (or current) occurrence of that
 * weekday from today, then add weeksOut * 7 days.
 */
function computeStartDate(startDay: DayOfWeek, weeksOut: number): string {
  const dayIndex = DAYS_OF_WEEK.indexOf(startDay); // 0=monday … 6=sunday
  // JS Date: 0=Sun,1=Mon…6=Sat → convert
  const jsDayIndex = (dayIndex + 1) % 7; // monday→1, sunday→0

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayJs = today.getDay(); // 0=Sun

  const daysUntil = (jsDayIndex - todayJs + 7) % 7;
  // If today is already that day, use today (daysUntil=0)
  const start = new Date(today);
  start.setDate(today.getDate() + daysUntil + weeksOut * 7);
  return toDateStr(start);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

// ─── Block ───────────────────────────────────────────────────────────────────

export const block: Block<Config, State> = {
  name: 'meal-plan',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c);
  },

  async apply(config, ctx) {
    const { userId } = ctx.resolve<{ userId: string }>('u');
    const templateState = ctx.resolve<{ templateId: ObjectId }>(config.templateRef);

    const tagFilter = seedTag(ctx);

    const mealPlansCol = ctx.db.collection('mealPlans');

    // ── Idempotency: if a tagged meal plan already exists, return its state ──
    const existing = await mealPlansCol.findOne(tagFilter);
    if (existing) {
      const existingItems = (existing.items as unknown[]) ?? [];
      return {
        state: {
          mealPlanId: existing._id as ObjectId,
          slotCount: existingItems.length,
        },
        docCount: 1,
        summary: `meal plan, ${existingItems.length} slots filled (already present)`,
      };
    }

    // ── Read template from DB to build snapshot ──
    const templatesCol = ctx.db.collection('mealPlanTemplates');
    const template = await templatesCol.findOne({ _id: templateState.templateId });
    if (!template) {
      throw new Error(
        `meal-plan: template not found in DB for id ${templateState.templateId.toString()}`
      );
    }

    const meals = template.meals as Record<MealType, boolean>;
    const startDay = template.startDay as DayOfWeek;

    // ── Resolve recipe ids ──
    const recipeIds: ObjectId[] = config.recipesRef
      ? ctx.resolve<{ recipeIds: ObjectId[] }>(config.recipesRef).recipeIds
      : [];

    // ── Compute dates ──
    const startDate = computeStartDate(startDay, config.weeksOut);
    const endDate = addDays(startDate, 6);

    // ── Generate slot items ──
    const enabledMealTypes = MEAL_TYPES.filter((m) => meals[m]);
    const slots: Array<{
      day: DayOfWeek;
      mealType: MealType;
    }> = [];

    // Build the full week grid in order, then take slotsFilled
    for (const day of DAYS_OF_WEEK) {
      for (const mealType of enabledMealTypes) {
        slots.push({ day, mealType });
      }
    }

    const selectedSlots = slots.slice(0, config.slotsFilled);

    const items = selectedSlots.map((slot, i) => {
      const recipeId =
        recipeIds.length > 0 ? recipeIds[i % recipeIds.length].toString() : PLACEHOLDER_RECIPE_ID;

      return {
        _id: new ObjectId().toString(),
        mealPlanId: '', // patched after insert
        dayOfWeek: slot.day,
        mealType: slot.mealType,
        items: [
          {
            type: 'recipe' as const,
            id: recipeId,
            name: 'Test Recipe',
            quantity: 1,
          },
        ],
      };
    });

    // ── Insert ──
    const now = new Date();
    const insertResult = await mealPlansCol.insertOne({
      userId,
      name: `${SEED_TITLE_PREFIX}Meal Plan [${ctx.label}]`,
      startDate,
      endDate,
      templateId: templateState.templateId.toString(),
      templateSnapshot: {
        startDay,
        meals,
      },
      items,
      createdAt: now,
      updatedAt: now,
      ...tagFilter,
    });

    const mealPlanId = insertResult.insertedId as ObjectId;

    // ── Patch items with correct mealPlanId ──
    const patchedItems = items.map((item) => ({
      ...item,
      mealPlanId: mealPlanId.toString(),
    }));

    await mealPlansCol.updateOne({ _id: mealPlanId }, { $set: { items: patchedItems } });

    return {
      state: { mealPlanId, slotCount: items.length },
      docCount: 1,
      summary: `meal plan, ${items.length} slots filled`,
    };
  },

  async clean(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const r = await ctx.db.collection('mealPlans').deleteMany(tagFilter);
    return { docCount: r.deletedCount ?? 0 };
  },

  async status(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const count = await ctx.db.collection('mealPlans').countDocuments(tagFilter);
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};
