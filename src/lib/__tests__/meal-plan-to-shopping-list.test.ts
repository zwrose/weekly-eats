import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractFoodItemsFromMealPlans, combineExtractedItems, mergeWithShoppingList } from '../meal-plan-to-shopping-list';
import { MealPlanWithTemplate } from '../../types/meal-plan';

describe('meal-plan-to-shopping-list utilities', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('extractFoodItemsFromMealPlans', () => {
    it('extracts food items directly from meal plans', async () => {
      const mealPlan: MealPlanWithTemplate = {
        _id: 'mp1',
        userId: 'user1',
        name: 'Week 1',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        templateId: 't1',
        templateSnapshot: {
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false }
        },
        items: [
          {
            _id: 'item1',
            mealPlanId: 'mp1',
            dayOfWeek: 'saturday',
            mealType: 'breakfast',
            items: [
              { type: 'foodItem', id: 'f1', name: 'Apple', quantity: 2, unit: 'piece' }
            ]
          }
        ],
        template: {
          _id: 't1',
          userId: 'user1',
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const items = await extractFoodItemsFromMealPlans([mealPlan]);
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        foodItemId: 'f1',
        quantity: 2,
        unit: 'piece'
      });
    });

    it('extracts food items from ingredient groups', async () => {
      const mealPlan: MealPlanWithTemplate = {
        _id: 'mp1',
        userId: 'user1',
        name: 'Week 1',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        templateId: 't1',
        templateSnapshot: {
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false }
        },
        items: [
          {
            _id: 'item1',
            mealPlanId: 'mp1',
            dayOfWeek: 'saturday',
            mealType: 'breakfast',
            items: [
              {
                type: 'ingredientGroup',
                id: 'ig1',
                name: 'Salad',
                ingredients: [
                  {
                    title: 'Veggies',
                    ingredients: [
                      { type: 'foodItem', id: 'f1', quantity: 1, unit: 'head' },
                      { type: 'foodItem', id: 'f2', quantity: 2, unit: 'piece' }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        template: {
          _id: 't1',
          userId: 'user1',
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const items = await extractFoodItemsFromMealPlans([mealPlan]);
      
      expect(items).toHaveLength(2);
      expect(items).toContainEqual({ foodItemId: 'f1', quantity: 1, unit: 'head' });
      expect(items).toContainEqual({ foodItemId: 'f2', quantity: 2, unit: 'piece' });
    });

    it('recursively extracts food items from recipes', async () => {
      mockFetch.mockImplementation((url) => {
        if (url === '/api/recipes/r1') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              _id: 'r1',
              title: 'Pasta',
              ingredients: [
                {
                  title: 'Main',
                  ingredients: [
                    { type: 'foodItem', id: 'f1', quantity: 1, unit: 'pound' },
                    { type: 'foodItem', id: 'f2', quantity: 2, unit: 'cup' }
                  ]
                }
              ]
            })
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mealPlan: MealPlanWithTemplate = {
        _id: 'mp1',
        userId: 'user1',
        name: 'Week 1',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        templateId: 't1',
        templateSnapshot: {
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false }
        },
        items: [
          {
            _id: 'item1',
            mealPlanId: 'mp1',
            dayOfWeek: 'saturday',
            mealType: 'dinner',
            items: [
              { type: 'recipe', id: 'r1', name: 'Pasta', quantity: 1 }
            ]
          }
        ],
        template: {
          _id: 't1',
          userId: 'user1',
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const items = await extractFoodItemsFromMealPlans([mealPlan]);
      
      expect(items).toHaveLength(2);
      expect(items).toContainEqual({ foodItemId: 'f1', quantity: 1, unit: 'pound' });
      expect(items).toContainEqual({ foodItemId: 'f2', quantity: 2, unit: 'cup' });
    });

    it('multiplies recipe ingredient quantities by meal plan recipe quantity', async () => {
      mockFetch.mockImplementation((url) => {
        if (url === '/api/recipes/r1') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              _id: 'r1',
              title: 'Pasta',
              ingredients: [
                {
                  title: 'Main',
                  ingredients: [
                    { type: 'foodItem', id: 'f1', quantity: 1, unit: 'pound' },
                    { type: 'foodItem', id: 'f2', quantity: 2, unit: 'cup' }
                  ]
                }
              ]
            })
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mealPlan: MealPlanWithTemplate = {
        _id: 'mp1',
        userId: 'user1',
        name: 'Week 1',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        templateId: 't1',
        templateSnapshot: {
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false }
        },
        items: [
          {
            _id: 'item1',
            mealPlanId: 'mp1',
            dayOfWeek: 'saturday',
            mealType: 'dinner',
            items: [
              { type: 'recipe', id: 'r1', name: 'Pasta', quantity: 3 }
            ]
          }
        ],
        template: {
          _id: 't1',
          userId: 'user1',
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const items = await extractFoodItemsFromMealPlans([mealPlan]);
      
      expect(items).toHaveLength(2);
      // 1 pound * 3 recipes = 3 pounds
      expect(items).toContainEqual({ foodItemId: 'f1', quantity: 3, unit: 'pound' });
      // 2 cups * 3 recipes = 6 cups
      expect(items).toContainEqual({ foodItemId: 'f2', quantity: 6, unit: 'cup' });
    });

    it('multiplies nested recipe quantities correctly', async () => {
      mockFetch.mockImplementation((url) => {
        if (url === '/api/recipes/r1') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              _id: 'r1',
              title: 'Dinner',
              ingredients: [
                {
                  title: 'Main',
                  ingredients: [
                    { type: 'foodItem', id: 'f1', quantity: 2, unit: 'pound' },
                    { type: 'recipe', id: 'r2', quantity: 2 }
                  ]
                }
              ]
            })
          } as Response);
        }
        if (url === '/api/recipes/r2') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              _id: 'r2',
              title: 'Side Dish',
              ingredients: [
                {
                  title: 'Ingredients',
                  ingredients: [
                    { type: 'foodItem', id: 'f2', quantity: 1, unit: 'cup' },
                    { type: 'foodItem', id: 'f3', quantity: 3, unit: 'piece' }
                  ]
                }
              ]
            })
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mealPlan: MealPlanWithTemplate = {
        _id: 'mp1',
        userId: 'user1',
        name: 'Week 1',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        templateId: 't1',
        templateSnapshot: {
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false }
        },
        items: [
          {
            _id: 'item1',
            mealPlanId: 'mp1',
            dayOfWeek: 'saturday',
            mealType: 'dinner',
            items: [
              { type: 'recipe', id: 'r1', name: 'Dinner', quantity: 3 }
            ]
          }
        ],
        template: {
          _id: 't1',
          userId: 'user1',
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const items = await extractFoodItemsFromMealPlans([mealPlan]);
      
      expect(items).toHaveLength(3);
      // f1: 2 pounds * 3 recipes = 6 pounds
      expect(items).toContainEqual({ foodItemId: 'f1', quantity: 6, unit: 'pound' });
      // f2: 1 cup * 2 nested recipes * 3 parent recipes = 6 cups
      expect(items).toContainEqual({ foodItemId: 'f2', quantity: 6, unit: 'cup' });
      // f3: 3 pieces * 2 nested recipes * 3 parent recipes = 18 pieces
      expect(items).toContainEqual({ foodItemId: 'f3', quantity: 18, unit: 'piece' });
    });

    it('multiplies recipe quantities in ingredient groups correctly', async () => {
      mockFetch.mockImplementation((url) => {
        if (url === '/api/recipes/r1') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              _id: 'r1',
              title: 'Recipe',
              ingredients: [
                {
                  title: 'Main',
                  ingredients: [
                    { type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }
                  ]
                }
              ]
            })
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mealPlan: MealPlanWithTemplate = {
        _id: 'mp1',
        userId: 'user1',
        name: 'Week 1',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        templateId: 't1',
        templateSnapshot: {
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false }
        },
        items: [
          {
            _id: 'item1',
            mealPlanId: 'mp1',
            dayOfWeek: 'saturday',
            mealType: 'breakfast',
            items: [
              {
                type: 'ingredientGroup',
                id: 'ig1',
                name: 'Meal',
                ingredients: [
                  {
                    title: 'Recipes',
                    ingredients: [
                      { type: 'recipe', id: 'r1', quantity: 2 }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        template: {
          _id: 't1',
          userId: 'user1',
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const items = await extractFoodItemsFromMealPlans([mealPlan]);
      
      expect(items).toHaveLength(1);
      // 1 cup * 2 recipes = 2 cups
      expect(items).toContainEqual({ foodItemId: 'f1', quantity: 2, unit: 'cup' });
    });

    it('handles missing recipe quantity in meal plan (defaults to 1)', async () => {
      mockFetch.mockImplementation((url) => {
        if (url === '/api/recipes/r1') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              _id: 'r1',
              title: 'Pasta',
              ingredients: [
                {
                  title: 'Main',
                  ingredients: [
                    { type: 'foodItem', id: 'f1', quantity: 1, unit: 'pound' }
                  ]
                }
              ]
            })
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mealPlan: MealPlanWithTemplate = {
        _id: 'mp1',
        userId: 'user1',
        name: 'Week 1',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        templateId: 't1',
        templateSnapshot: {
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false }
        },
        items: [
          {
            _id: 'item1',
            mealPlanId: 'mp1',
            dayOfWeek: 'saturday',
            mealType: 'dinner',
            items: [
              { type: 'recipe', id: 'r1', name: 'Pasta' } // No quantity specified
            ]
          }
        ],
        template: {
          _id: 't1',
          userId: 'user1',
          startDay: 'saturday',
          meals: { breakfast: true, lunch: true, dinner: true, staples: false },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const items = await extractFoodItemsFromMealPlans([mealPlan]);
      
      expect(items).toHaveLength(1);
      // Should default to quantity 1 if not specified
      expect(items).toContainEqual({ foodItemId: 'f1', quantity: 1, unit: 'pound' });
    });
  });

  describe('combineExtractedItems', () => {
    it('combines items with same foodItemId and unit (AC-5: silent sum)', () => {
      const items = [
        { foodItemId: 'f1', quantity: 2, unit: 'cup' },
        { foodItemId: 'f1', quantity: 3, unit: 'cup' },
        { foodItemId: 'f2', quantity: 1, unit: 'piece' }
      ];

      const { combinedItems, conflicts } = combineExtractedItems(items);

      expect(combinedItems).toHaveLength(2);
      expect(combinedItems).toContainEqual({ foodItemId: 'f1', quantity: 5, unit: 'cup' });
      expect(combinedItems).toContainEqual({ foodItemId: 'f2', quantity: 1, unit: 'piece' });
      expect(conflicts).toHaveLength(0);
    });

    it('flags convertible units as conflict with suggested values and unitBreakdown', () => {
      // 2 cups + 1 pint (= 2 cups) → convertible, shown as conflict with suggestion
      const items = [
        { foodItemId: 'f1', quantity: 2, unit: 'cup' },
        { foodItemId: 'f1', quantity: 1, unit: 'pint' }
      ];

      const { combinedItems, conflicts } = combineExtractedItems(items);

      // Should appear as a conflict for user review
      expect(conflicts).toHaveLength(1);
      const conflict = conflicts.find(c => c.foodItemId === 'f1')!;
      expect(conflict).toBeDefined();
      expect(conflict.isAutoConverted).toBe(true);
      expect(conflict.suggestedQuantity).toBeGreaterThan(0);
      expect(conflict.suggestedUnit).toBeDefined();
      expect(conflict.items).toHaveLength(2);
      // unitBreakdown shows per-unit sums
      expect(conflict.unitBreakdown).toEqual([
        { quantity: 2, unit: 'cup' },
        { quantity: 1, unit: 'pint' },
      ]);

      // Placeholder should still exist in combinedItems
      const f1 = combinedItems.find(i => i.foodItemId === 'f1');
      expect(f1).toBeDefined();
    });

    it('flags non-convertible unit conflicts with unitBreakdown and keeps item in combinedItems', () => {
      // cans vs pounds — different families, cannot auto-convert
      const items = [
        { foodItemId: 'f1', quantity: 2, unit: 'can' },
        { foodItemId: 'f1', quantity: 1, unit: 'pound' }
      ];

      const { combinedItems, conflicts } = combineExtractedItems(items);

      expect(conflicts).toHaveLength(1);
      const conflict = conflicts.find(c => c.foodItemId === 'f1')!;
      expect(conflict).toBeDefined();
      expect(conflict.isAutoConverted).toBe(false);
      expect(conflict.suggestedQuantity).toBeUndefined();
      expect(conflict.items).toHaveLength(2);
      expect(conflict.unitBreakdown).toEqual([
        { quantity: 2, unit: 'can' },
        { quantity: 1, unit: 'pound' },
      ]);
      // Item should still appear in combinedItems as a placeholder
      const f1 = combinedItems.find(i => i.foodItemId === 'f1');
      expect(f1).toBeDefined();
      expect(f1!.quantity).toBe(2);
      expect(f1!.unit).toBe('can');
    });

    it('handles mixed: convertible conflict, non-convertible conflict, single-entry', () => {
      const items = [
        // f1: convertible (cup + tablespoon → same family) — conflict with suggestion
        { foodItemId: 'f1', quantity: 1, unit: 'cup' },
        { foodItemId: 'f1', quantity: 8, unit: 'tablespoon' },
        // f2: non-convertible (can vs pound) — conflict without suggestion
        { foodItemId: 'f2', quantity: 2, unit: 'can' },
        { foodItemId: 'f2', quantity: 1, unit: 'pound' },
        // f3: single entry (no combining needed)
        { foodItemId: 'f3', quantity: 3, unit: 'piece' }
      ];

      const { combinedItems, conflicts } = combineExtractedItems(items);

      // Both f1 and f2 are conflicts (different units)
      expect(conflicts).toHaveLength(2);

      // f1: convertible conflict with suggestion
      const f1Conflict = conflicts.find(c => c.foodItemId === 'f1')!;
      expect(f1Conflict).toBeDefined();
      expect(f1Conflict.isAutoConverted).toBe(true);
      expect(f1Conflict.suggestedQuantity).toBeGreaterThan(0);
      const f1 = combinedItems.find(i => i.foodItemId === 'f1');
      expect(f1).toBeDefined();

      // f2: non-convertible conflict
      const f2Conflict = conflicts.find(c => c.foodItemId === 'f2')!;
      expect(f2Conflict).toBeDefined();
      expect(f2Conflict.isAutoConverted).toBe(false);
      const f2 = combinedItems.find(i => i.foodItemId === 'f2');
      expect(f2).toBeDefined();

      // f3 passes through as-is
      expect(combinedItems).toContainEqual({ foodItemId: 'f3', quantity: 3, unit: 'piece' });
    });

    it('combines existing shopping list items with extracted items in unified flow', () => {
      // Simulates the unified pre-merge: existing list has 2 cups, extracted has 1 pint
      const existingAsExtracted = [
        { foodItemId: 'f1', quantity: 2, unit: 'cup' },
      ];
      const extractedItems = [
        { foodItemId: 'f1', quantity: 1, unit: 'pint' },
      ];

      const { combinedItems, conflicts } = combineExtractedItems([
        ...existingAsExtracted,
        ...extractedItems,
      ]);

      // Should produce one conflict (convertible) with unitBreakdown summing per-unit
      expect(conflicts).toHaveLength(1);
      const conflict = conflicts.find(c => c.foodItemId === 'f1')!;
      expect(conflict.isAutoConverted).toBe(true);
      expect(conflict.unitBreakdown).toEqual([
        { quantity: 2, unit: 'cup' },
        { quantity: 1, unit: 'pint' },
      ]);
      expect(conflict.suggestedQuantity).toBeGreaterThan(0);

      // Placeholder in combinedItems
      const f1 = combinedItems.find(i => i.foodItemId === 'f1');
      expect(f1).toBeDefined();
    });

    it('silently sums when existing list and extracted items share the same unit', () => {
      // Existing: 2 cups, extracted: 3 cups → same unit, silent sum
      const allItems = [
        { foodItemId: 'f1', quantity: 2, unit: 'cup' },
        { foodItemId: 'f1', quantity: 3, unit: 'cup' },
      ];

      const { combinedItems, conflicts } = combineExtractedItems(allItems);

      expect(conflicts).toHaveLength(0);
      expect(combinedItems).toHaveLength(1);
      expect(combinedItems[0]).toEqual({ foodItemId: 'f1', quantity: 5, unit: 'cup' });
    });

    it('flags three+ different convertible units as single conflict with suggestion', () => {
      // 2 cups + 1 pint + 1 quart → all volume, conflict with suggested conversion
      const items = [
        { foodItemId: 'f1', quantity: 2, unit: 'cup' },
        { foodItemId: 'f1', quantity: 1, unit: 'pint' },
        { foodItemId: 'f1', quantity: 1, unit: 'quart' }
      ];

      const { combinedItems, conflicts } = combineExtractedItems(items);

      expect(conflicts).toHaveLength(1);
      const conflict = conflicts.find(c => c.foodItemId === 'f1')!;
      expect(conflict).toBeDefined();
      expect(conflict.isAutoConverted).toBe(true);
      // 2 cups + 2 cups (1 pint) + 4 cups (1 quart) = 8 cups total
      expect(conflict.suggestedQuantity).toBeGreaterThan(0);
      expect(conflict.suggestedUnit).toBeDefined();
      expect(conflict.items).toHaveLength(3);

      // Placeholder in combinedItems
      const f1 = combinedItems.find(i => i.foodItemId === 'f1');
      expect(f1).toBeDefined();
    });
  });

  describe('mergeWithShoppingList', () => {
    it('adds new items to shopping list', () => {
      const existingItems = [
        { foodItemId: 'f1', name: 'Apples', quantity: 2, unit: 'piece', checked: false }
      ];

      const extractedItems = [
        { foodItemId: 'f2', quantity: 1, unit: 'gallon' }
      ];

      const foodItemsMap = new Map([
        ['f2', { singularName: 'milk', pluralName: 'milks', unit: 'gallon' }]
      ]);

      const { mergedItems, conflicts } = mergeWithShoppingList(existingItems, extractedItems, foodItemsMap);
      
      expect(mergedItems).toHaveLength(2);
      expect(mergedItems.find(i => i.foodItemId === 'f2')).toEqual({
        foodItemId: 'f2',
        name: 'milk',
        quantity: 1,
        unit: 'gallon',
        checked: false
      });
      expect(conflicts).toHaveLength(0);
    });

    it('combines quantities for items with same unit', () => {
      const existingItems = [
        { foodItemId: 'f1', name: 'Apples', quantity: 2, unit: 'piece', checked: false }
      ];

      const extractedItems = [
        { foodItemId: 'f1', quantity: 3, unit: 'piece' }
      ];

      const foodItemsMap = new Map([
        ['f1', { singularName: 'apple', pluralName: 'apples', unit: 'piece' }]
      ]);

      const { mergedItems, conflicts } = mergeWithShoppingList(existingItems, extractedItems, foodItemsMap);
      
      expect(mergedItems).toHaveLength(1);
      expect(mergedItems[0]).toEqual({
        foodItemId: 'f1',
        name: 'apples',
        quantity: 5,
        unit: 'piece',
        checked: false
      });
      expect(conflicts).toHaveLength(0);
    });

    it('auto-converts and pre-fills conflict for convertible units', () => {
      // Existing: 2 cups, extracted: 8 tablespoons (= 0.5 cups)
      const existingItems = [
        { foodItemId: 'f1', name: 'milk', quantity: 2, unit: 'cup', checked: false }
      ];

      const extractedItems = [
        { foodItemId: 'f1', quantity: 8, unit: 'tablespoon' }
      ];

      const foodItemsMap = new Map([
        ['f1', { singularName: 'milk', pluralName: 'milks', unit: 'cup' }]
      ]);

      const { conflicts } = mergeWithShoppingList(existingItems, extractedItems, foodItemsMap);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].isAutoConverted).toBe(true);
      expect(conflicts[0].suggestedQuantity).toBeGreaterThan(0);
      expect(conflicts[0].suggestedUnit).toBeDefined();
    });

    it('flags non-convertible units as manual conflicts', () => {
      // Existing: 2 cans, extracted: 1 pound — different families
      const existingItems = [
        { foodItemId: 'f1', name: 'Tomatoes', quantity: 2, unit: 'can', checked: false }
      ];

      const extractedItems = [
        { foodItemId: 'f1', quantity: 1, unit: 'pound' }
      ];

      const foodItemsMap = new Map([
        ['f1', { singularName: 'tomato', pluralName: 'tomatoes', unit: 'can' }]
      ]);

      const { conflicts } = mergeWithShoppingList(existingItems, extractedItems, foodItemsMap);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].isAutoConverted).toBe(false);
      expect(conflicts[0].foodItemId).toBe('f1');
      expect(conflicts[0].existingQuantity).toBe(2);
      expect(conflicts[0].existingUnit).toBe('can');
      expect(conflicts[0].newQuantity).toBe(1);
      expect(conflicts[0].newUnit).toBe('pound');
    });

    it('still sums quantities for same units (existing behavior)', () => {
      const existingItems = [
        { foodItemId: 'f1', name: 'milk', quantity: 2, unit: 'cup', checked: false }
      ];

      const extractedItems = [
        { foodItemId: 'f1', quantity: 3, unit: 'cup' }
      ];

      const foodItemsMap = new Map([
        ['f1', { singularName: 'milk', pluralName: 'milks', unit: 'cup' }]
      ]);

      const { mergedItems, conflicts } = mergeWithShoppingList(existingItems, extractedItems, foodItemsMap);

      expect(conflicts).toHaveLength(0);
      expect(mergedItems).toHaveLength(1);
      expect(mergedItems[0].quantity).toBe(5);
      expect(mergedItems[0].unit).toBe('cup');
    });

    it('still adds new items directly (existing behavior)', () => {
      const existingItems = [
        { foodItemId: 'f1', name: 'milk', quantity: 2, unit: 'cup', checked: false }
      ];

      const extractedItems = [
        { foodItemId: 'f2', quantity: 1, unit: 'pound' }
      ];

      const foodItemsMap = new Map([
        ['f2', { singularName: 'flour', pluralName: 'flours', unit: 'pound' }]
      ]);

      const { mergedItems, conflicts } = mergeWithShoppingList(existingItems, extractedItems, foodItemsMap);

      expect(conflicts).toHaveLength(0);
      expect(mergedItems).toHaveLength(2);
      expect(mergedItems.find(i => i.foodItemId === 'f2')?.quantity).toBe(1);
    });
  });
});

