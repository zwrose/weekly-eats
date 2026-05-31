import { describe, it, expect } from 'vitest';
import { getSectionForPath, NAV_SECTIONS } from '../nav-sections';

describe('getSectionForPath', () => {
  it.each([
    ['/meal-plans', 'plans'],
    ['/meal-plans/abc123', 'plans'],
    ['/shopping-lists', 'shop'],
    ['/shopping-lists/xyz', 'shop'],
    ['/recipes', 'recipes'],
    ['/recipes/42', 'recipes'],
    ['/pantry', 'pantry'],
    ['/pantry/whatever', 'pantry'],
  ])('maps %s -> %s', (path, expected) => {
    expect(getSectionForPath(path)).toBe(expected);
  });

  it.each([
    '/food-items',
    '/user-management',
    '/settings',
    '/pending-approval',
    '/',
    '/mealplansX',
  ])('returns null for system/non-section path %s', (path) => {
    expect(getSectionForPath(path)).toBeNull();
  });

  it('returns null for null pathname', () => {
    expect(getSectionForPath(null)).toBeNull();
  });
});

describe('NAV_SECTIONS', () => {
  it('has the four sections in order with hrefs + icons', () => {
    expect(NAV_SECTIONS.map((s) => s.key)).toEqual(['plans', 'shop', 'recipes', 'pantry']);
    expect(NAV_SECTIONS.map((s) => s.href)).toEqual([
      '/meal-plans',
      '/shopping-lists',
      '/recipes',
      '/pantry',
    ]);
    expect(NAV_SECTIONS.every((s) => s.icon && s.color && s.label)).toBe(true);
  });
});
