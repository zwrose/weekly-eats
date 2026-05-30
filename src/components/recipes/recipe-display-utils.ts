import { tokens } from '@/lib/design-tokens';
import type { RecipeIngredientList } from '@/types/recipe';

export type AccessLevel = 'private' | 'shared-by-you' | 'shared-by-others';

/**
 * Semi-transparent recipe orange for selected-state backgrounds (chips, selected emoji, radio rows).
 * NOT a token: `tokens.accent.muted` is the BLUE plans accent, and `tokens.section.recipes` has no
 * muted variant. Every recipe component imports THIS for selected backgrounds.
 */
export const RECIPE_ACCENT_MUTED = 'rgba(232,168,107,0.16)';

/** Label + token color for the access pill shown on the recipe view + list. */
export function accessLevelMeta(access: AccessLevel): { label: string; color: string } {
  switch (access) {
    case 'shared-by-you':
      return { label: 'Shared by you', color: tokens.state.success };
    case 'shared-by-others':
      return { label: 'Shared by others', color: tokens.section.recipes };
    case 'private':
    default:
      return { label: 'Private', color: tokens.text.secondary };
  }
}

/** Quantity + unit for an ingredient row; "each"/missing units render bare (matches the artboard). */
export function formatIngredientQty(qty: number, unit?: string): string {
  if (!unit || unit === 'each') return String(qty);
  return `${qty} ${unit}`;
}

/** Total ingredient count across all groups/lists. */
export function recipeIngredientCount(lists: RecipeIngredientList[]): number {
  return lists.reduce((sum, list) => sum + (list.ingredients?.length ?? 0), 0);
}
