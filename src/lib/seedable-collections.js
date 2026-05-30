/**
 * Single source of truth for collections that can carry `_seedManifestId` /
 * `_seedScenarioId` tags from the manual-testing scenario engine.
 *
 * Plain ESM .js so both TypeScript (`src/lib/database-indexes.ts`,
 * `test/manual/types.ts` via re-export) and plain-Node scripts can import it
 * without a build step.
 *
 * Adding a new seedable collection? Add it here only — `database-indexes.ts`
 * uses this list to create the `_seedTag` index, and `types.ts` re-exports it
 * as `KNOWN_COLLECTIONS` for the CLI's `clean --all` and registry-validation
 * tests.
 */
export const SEEDABLE_COLLECTIONS = /** @type {const} */ ([
  'mealPlans',
  'mealPlanTemplates',
  'foodItems',
  'recipes',
  'recipeUserData',
  'pantry',
  'stores',
  'storeItemPositions',
  'shoppingLists',
  'purchaseHistory',
  'users',
]);
