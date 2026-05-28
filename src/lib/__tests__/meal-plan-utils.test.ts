import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkMealPlanOverlap,
  findNextAvailableMealPlanStartDate,
  DEFAULT_TEMPLATE,
} from '../meal-plan-utils';

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

  describe('checkMealPlanOverlap edge cases', () => {
    it('returns not overlapping when startDate is empty', () => {
      const existingPlans = [
        { _id: '1', name: 'Week A', startDate: '2024-03-01', endDate: '2024-03-07' },
      ] as any;
      expect(checkMealPlanOverlap('', existingPlans)).toEqual({ isOverlapping: false });
    });

    it('treats a plan whose endDate equals the new startDate as overlapping (touching boundary)', () => {
      // calculateEndDateAsString('2024-03-07') -> '2024-03-13', and the existing
      // plan ends exactly on the new start date, so the boundary touches and counts.
      const existingPlans = [
        { _id: '1', name: 'Week A', startDate: '2024-03-01', endDate: '2024-03-07' },
      ] as any;
      const result = checkMealPlanOverlap('2024-03-07', existingPlans);
      expect(result.isOverlapping).toBe(true);
      expect(result.conflict).toEqual({
        planName: 'Week A',
        startDate: '2024-03-01',
        endDate: '2024-03-07',
      });
    });

    it('returns not overlapping when excludePlanId matches the only conflicting plan', () => {
      const existingPlans = [
        { _id: '1', name: 'Week A', startDate: '2024-03-01', endDate: '2024-03-07' },
      ] as any;
      const result = checkMealPlanOverlap('2024-03-05', existingPlans, '1');
      expect(result).toEqual({ isOverlapping: false });
    });

    it('throws when an existing plan has a non-string (Date) startDate', () => {
      const existingPlans = [
        {
          _id: '1',
          name: 'Week A',
          startDate: new Date('2024-03-01'),
          endDate: '2024-03-07',
        },
      ] as any;
      expect(() => checkMealPlanOverlap('2024-03-05', existingPlans)).toThrow();
    });

    it('returns not overlapping for fully-separate date ranges', () => {
      const existingPlans = [
        { _id: '1', name: 'Week A', startDate: '2024-01-01', endDate: '2024-01-07' },
      ] as any;
      // New plan spans 2024-03-01..2024-03-07, no overlap with January plan.
      const result = checkMealPlanOverlap('2024-03-01', existingPlans);
      expect(result).toEqual({ isOverlapping: false });
    });
  });

  describe('findNextAvailableMealPlanStartDate skip-advance loop', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('advances past multiple consecutive conflicts in a single call', () => {
      vi.useFakeTimers();
      // 2026-05-28 is a Thursday; the first Saturday candidate is 2026-05-30.
      vi.setSystemTime(new Date('2026-05-28'));

      const plans: any[] = [
        // Conflicts with the 2026-05-30 candidate; ends Friday so the next
        // Saturday is 2026-06-06.
        { _id: '1', name: 'Week A', startDate: '2026-05-30', endDate: '2026-06-05' },
        // Conflicts with the 2026-06-06 candidate; ends Friday so the next
        // Saturday is 2026-06-13 (free).
        { _id: '2', name: 'Week B', startDate: '2026-06-06', endDate: '2026-06-12' },
      ];

      const result = findNextAvailableMealPlanStartDate('saturday', plans);

      expect(result.startDate).toBe('2026-06-13');
      expect(result.skipped).toBe(true);
      expect(result.skippedFrom).toBe('2026-05-30');
    });

    it('does not skip when the first candidate is already free', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-28'));

      const result = findNextAvailableMealPlanStartDate('saturday', []);

      expect(result.startDate).toBe('2026-05-30');
      expect(result.skipped).toBe(false);
      expect(result.skippedFrom).toBeUndefined();
    });
  });
});
