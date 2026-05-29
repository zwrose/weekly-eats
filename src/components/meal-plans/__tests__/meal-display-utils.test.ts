import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getEnabledMeals,
  mealItemCount,
  computeTodayDow,
  MEAL_ORDER,
  MEAL_LABEL,
  MEAL_LETTER,
} from '../meal-display-utils';
import type { MealItem } from '@/types/meal-plan';

describe('getEnabledMeals', () => {
  it('returns B/L/D in order, filtered by the template toggles (staples excluded)', () => {
    expect(getEnabledMeals({ breakfast: true, lunch: false, dinner: true, staples: true })).toEqual(
      ['breakfast', 'dinner']
    );
  });
  it('returns empty array when no meals enabled', () => {
    expect(
      getEnabledMeals({ breakfast: false, lunch: false, dinner: false, staples: false })
    ).toEqual([]);
  });
});

describe('mealItemCount', () => {
  it('counts loose items once and a group as its ingredient count', () => {
    const items: MealItem[] = [
      { type: 'recipe', id: 'r1', name: 'Pasta', quantity: 1 },
      {
        type: 'ingredientGroup',
        id: '',
        name: 'Side salad',
        ingredients: [
          {
            title: 'Side salad',
            ingredients: [
              { type: 'foodItem', id: 'f1', quantity: 1, unit: 'head' },
              { type: 'foodItem', id: 'f2', quantity: 1, unit: 'pint' },
            ],
          },
        ],
      },
    ];
    // 1 recipe + 2 group ingredients = 3
    expect(mealItemCount(items)).toBe(3);
  });
  it('returns 0 for empty', () => {
    expect(mealItemCount([])).toBe(0);
  });
});

describe('constants', () => {
  it('MEAL_ORDER is B,L,D', () => {
    expect(MEAL_ORDER).toEqual(['breakfast', 'lunch', 'dinner']);
  });
  it('label + letter maps', () => {
    expect(MEAL_LABEL.dinner).toBe('Dinner');
    expect(MEAL_LETTER.breakfast).toBe('B');
  });
});

describe('computeTodayDow', () => {
  afterEach(() => vi.useRealTimers());
  const plan = { startDate: '2026-05-11', endDate: '2026-05-17' }; // Mon–Sun

  it('returns the weekday when today is inside the range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T12:00:00')); // Wednesday
    expect(computeTodayDow(plan)).toBe('wednesday');
  });
  it('returns null when today is before the range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00'));
    expect(computeTodayDow(plan)).toBeNull();
  });
  it('returns null when today is after the range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00'));
    expect(computeTodayDow(plan)).toBeNull();
  });
  it('returns null for a null plan', () => {
    expect(computeTodayDow(null)).toBeNull();
  });
});
