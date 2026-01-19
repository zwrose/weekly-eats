import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractFoodItemsFromMealPlans, combineExtractedItems, mergeWithShoppingList } from '../meal-plan-to-shopping-list';
import { MealPlanWithTemplate } from '../../types/meal-plan';

describe('meal-plan-to-shopping-list utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      global.fetch = vi.fn((url) => {
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
      }) as any;

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
      global.fetch = vi.fn((url) => {
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
      }) as any;

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
      global.fetch = vi.fn((url) => {
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
      }) as any;

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
      global.fetch = vi.fn((url) => {
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
      }) as any;

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
      global.fetch = vi.fn((url) => {
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
      }) as any;

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
    it('combines items with same foodItemId and unit', () => {
      const items = [
        { foodItemId: 'f1', quantity: 2, unit: 'cup' },
        { foodItemId: 'f1', quantity: 3, unit: 'cup' },
        { foodItemId: 'f2', quantity: 1, unit: 'piece' }
      ];

      const { combinedItems, conflicts } = combineExtractedItems(items);
      
      expect(combinedItems).toHaveLength(2);
      expect(combinedItems).toContainEqual({ foodItemId: 'f1', quantity: 5, unit: 'cup' });
      expect(combinedItems).toContainEqual({ foodItemId: 'f2', quantity: 1, unit: 'piece' });
      expect(conflicts.size).toBe(0);
    });

    it('identifies unit conflicts', () => {
      const items = [
        { foodItemId: 'f1', quantity: 2, unit: 'cup' },
        { foodItemId: 'f1', quantity: 3, unit: 'gallon' }
      ];

      const { combinedItems, conflicts } = combineExtractedItems(items);
      
      expect(conflicts.size).toBe(1);
      expect(conflicts.has('f1')).toBe(true);
      expect(conflicts.get('f1')).toHaveLength(2);
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

    it('identifies unit conflicts when merging', () => {
      const existingItems = [
        { foodItemId: 'f1', name: 'milk', quantity: 2, unit: 'cup', checked: false }
      ];

      const extractedItems = [
        { foodItemId: 'f1', quantity: 1, unit: 'gallon' }
      ];

      const foodItemsMap = new Map([
        ['f1', { singularName: 'milk', pluralName: 'milks', unit: 'gallon' }]
      ]);

      const { mergedItems, conflicts } = mergeWithShoppingList(existingItems, extractedItems, foodItemsMap);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual({
        foodItemId: 'f1',
        foodItemName: 'milks',
        existingQuantity: 2,
        existingUnit: 'cup',
        newQuantity: 1,
        newUnit: 'gallon'
      });
    });
  });
});

