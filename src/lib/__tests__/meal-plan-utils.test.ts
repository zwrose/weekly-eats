import { describe, it, expect } from 'vitest';
import { checkMealPlanOverlap, findNextAvailableMealPlanStartDate, DEFAULT_TEMPLATE } from '../meal-plan-utils';

describe('meal-plan-utils', () => {
  it('detects overlap between meal plans', () => {
    const existingPlans = [
      { _id: '1', name: 'Week A', startDate: '2024-03-01', endDate: '2024-03-07' },
    ] as any;
    const result = checkMealPlanOverlap('2024-03-05', existingPlans);
    expect(result.isOverlapping).toBe(true);
  });

  it('finds next available start date based on template day', () => {
    const plans: any[] = [
      { _id: '1', name: 'Busy', startDate: '2099-01-02', endDate: '2099-01-08' },
    ];
    const next = findNextAvailableMealPlanStartDate(DEFAULT_TEMPLATE.startDay, plans);
    expect(next.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});


