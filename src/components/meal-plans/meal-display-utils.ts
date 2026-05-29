// src/components/meal-plans/meal-display-utils.ts
import type { DayOfWeek, MealItem, MealPlanItem, MealType } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { formatDateForAPI, parseLocalDate, dayOfWeekToIndex } from '@/lib/date-utils';
import { addDays } from 'date-fns';

/** Shared contract for the read-mode plan views (desktop + mobile). */
export interface PlanViewProps {
  mealsByDay: Record<string, Partial<Record<MealType, MealPlanItem>>>;
  daysInOrder: DayOfWeek[];
  dateLabelForDay: (dow: DayOfWeek) => string;
  enabledMeals: MealType[];
  todayDow: DayOfWeek | null;
  onEditMeal: (dow: DayOfWeek, mealType: MealType) => void;
}

export const MEAL_ORDER: Exclude<MealType, 'staples'>[] = ['breakfast', 'lunch', 'dinner'];

export const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export const MEAL_LETTER: Record<string, string> = {
  breakfast: 'B',
  lunch: 'L',
  dinner: 'D',
};

/** B/L/D the template enables, in canonical order. Staples is a sibling concept, never here. */
export function getEnabledMeals(meals: { [k in MealType]?: boolean }): MealType[] {
  return MEAL_ORDER.filter((m) => meals[m]);
}

/** Total shopping-relevant lines: loose items count 1, a group counts its ingredients. */
export function mealItemCount(items: MealItem[]): number {
  return items.reduce((n, it) => {
    if (it.type === 'ingredientGroup') {
      return n + (it.ingredients?.[0]?.ingredients?.length ?? 0);
    }
    return n + 1;
  }, 0);
}

/** Meal-domain accent token for a meal type (breakfast/lunch/dinner). */
export function mealColorToken(mealType: string): string {
  if (mealType === 'breakfast') return tokens.meal.breakfast;
  if (mealType === 'lunch') return tokens.meal.lunch;
  if (mealType === 'dinner') return tokens.meal.dinner;
  return tokens.meal.staples;
}

/** The DayOfWeek for "today" if today falls within the plan's date range, else null.
 *  (Time-dependent: tests pin the clock with vi.setSystemTime.) */
export function computeTodayDow(
  plan: { startDate: string; endDate: string } | null
): DayOfWeek | null {
  if (!plan) return null;
  const today = formatDateForAPI(new Date());
  if (today < plan.startDate || today > plan.endDate) return null;
  const days: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return days[parseLocalDate(today).getDay()];
}

/** The week (7 DayOfWeek values) rotated to begin at `startDay`.
 *  Moved verbatim from meal-plans/page.tsx; takes startDay as an arg
 *  instead of closing over the selected plan. */
export function getDaysInOrder(startDay: DayOfWeek): DayOfWeek[] {
  const days: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  const startIndex = days.indexOf(startDay);
  return [...days.slice(startIndex), ...days.slice(0, startIndex)];
}

/** A short, human date label ("Mon, May 11") for `dow` within a plan whose
 *  week begins on `startDay` at `startDate`. Moved from meal-plans/page.tsx
 *  with one intentional change: weekday: 'short' (was 'long') to match the
 *  redesign artboards. */
export function getDateForDay(startDate: string, dow: DayOfWeek, startDay: DayOfWeek): string {
  const start = parseLocalDate(startDate);
  const targetDayIndex = dayOfWeekToIndex(dow);
  const startDayIndex = dayOfWeekToIndex(startDay);

  let daysToAdd = targetDayIndex - startDayIndex;
  if (daysToAdd < 0) daysToAdd += 7;

  const targetDate = addDays(start, daysToAdd);

  return targetDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
