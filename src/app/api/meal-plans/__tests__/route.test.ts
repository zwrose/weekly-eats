import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findMock = vi.fn();
const toArrayMock = vi.fn();
const insertOneMock = vi.fn();
const findOneMock = vi.fn();
const updateOneMock = vi.fn();

// Mock food items and recipes for name population (using valid ObjectId format)
const mockFoodItems = {
  '507f1f77bcf86cd799439011': { _id: { toString: () => '507f1f77bcf86cd799439011' }, singularName: 'apple', pluralName: 'apples', unit: 'piece' },
  '507f1f77bcf86cd799439012': { _id: { toString: () => '507f1f77bcf86cd799439012' }, singularName: 'cup of rice', pluralName: 'cups of rice', unit: 'cup' },
};

const mockRecipes = {
  '507f1f77bcf86cd799439021': { _id: { toString: () => '507f1f77bcf86cd799439021' }, title: 'Pasta Carbonara' },
  '507f1f77bcf86cd799439022': { _id: { toString: () => '507f1f77bcf86cd799439022' }, title: 'Caesar Salad' },
};

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'mealPlans') {
          return {
            find: findMock.mockImplementation(() => ({
              toArray: toArrayMock,
              sort: () => ({ toArray: toArrayMock }),
            })),
            insertOne: insertOneMock,
            findOne: findOneMock,
            updateOne: updateOneMock,
          };
        }
        if (name === 'mealPlanTemplates') {
          return {
            findOne: findOneMock,
            insertOne: insertOneMock,
          };
        }
        if (name === 'foodItems') {
          return {
            find: vi.fn((query: any) => ({
              toArray: vi.fn(() => {
                const ids = query._id?.$in?.map((id: any) => id.toString()) || [];
                return Promise.resolve(ids.map((id: string) => mockFoodItems[id as keyof typeof mockFoodItems]).filter(Boolean));
              }),
            })),
            findOne: vi.fn((query: any) => {
              const id = query._id?.toString();
              return Promise.resolve(mockFoodItems[id as keyof typeof mockFoodItems] || null);
            }),
          };
        }
        if (name === 'recipes') {
          return {
            find: vi.fn((query: any) => ({
              toArray: vi.fn(() => {
                const ids = query._id?.$in?.map((id: any) => id.toString()) || [];
                return Promise.resolve(ids.map((id: string) => mockRecipes[id as keyof typeof mockRecipes]).filter(Boolean));
              }),
            })),
            findOne: vi.fn((query: any) => {
              const id = query._id?.toString();
              return Promise.resolve(mockRecipes[id as keyof typeof mockRecipes] || null);
            }),
          };
        }
        if (name === 'users') {
          return {
            find: () => ({
              toArray: vi.fn().mockResolvedValue([]), // No shared users by default
            }),
          };
        }
        return {} as any;
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body } as any);

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
  findOneMock.mockReset();
  insertOneMock.mockReset();
  updateOneMock.mockReset();
});

describe('api/meal-plans route', () => {
  it('GET requires auth', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeReq('http://localhost/api/meal-plans'));
    expect(res.status).toBe(401);
  });

  it('GET returns user meal plans', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      {
        _id: 'p1',
        name: 'Week A',
        templateId: 't1',
        templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
        items: [],
        createdAt: new Date()
      },
    ]);
    const res = await routes.GET(makeReq('http://localhost/api/meal-plans'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json[0]).toHaveProperty('template');
    expect(json[0].items).toBeDefined();
  });

  it('POST validates startDate and creates meal plan', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    // Existing plans for overlap check
    toArrayMock.mockResolvedValueOnce([]); // existing plans for overlap
    // No existing template -> create default
    findOneMock.mockResolvedValueOnce(null); // templatesCollection.findOne
    insertOneMock.mockResolvedValueOnce({ insertedId: 't-new' }); // templates insert
    findOneMock.mockResolvedValueOnce({ _id: 't-new', startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] });
    // Insert meal plan
    insertOneMock.mockResolvedValueOnce({ insertedId: 'p-new' });
    findOneMock.mockResolvedValueOnce({ _id: 'p-new', name: 'Week of ...', templateId: 't-new', templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] }, createdAt: new Date() });
    // Update meal plan with items
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

    const res = await routes.POST(makeReq('http://localhost/api/meal-plans', { startDate: '2024-03-01' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('_id');
    expect(body).toHaveProperty('template');
  });

  it('GET populates names for food items in meal plans', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      { 
        _id: 'p1', 
        name: 'Week A', 
        templateId: 't1', 
        templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
        items: [{
          _id: 'item-1',
          mealPlanId: 'p1',
          dayOfWeek: 'saturday',
          mealType: 'breakfast',
          items: [
            { type: 'foodItem', id: '507f1f77bcf86cd799439011', quantity: 2, unit: 'piece' }
          ]
        }],
        createdAt: new Date() 
      },
    ]);
    
    const res = await routes.GET(makeReq('http://localhost/api/meal-plans'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].items[0].items[0].name).toBe('apples'); // Plural because quantity is 2
  });

  it('GET populates names for recipes in meal plans', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      { 
        _id: 'p1', 
        name: 'Week A', 
        templateId: 't1', 
        templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
        items: [{
          _id: 'item-1',
          mealPlanId: 'p1',
          dayOfWeek: 'saturday',
          mealType: 'dinner',
          items: [
            { type: 'recipe', id: '507f1f77bcf86cd799439021', quantity: 1 }
          ]
        }],
        createdAt: new Date() 
      },
    ]);
    
    const res = await routes.GET(makeReq('http://localhost/api/meal-plans'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].items[0].items[0].name).toBe('Pasta Carbonara');
  });

  it('GET populates names for ingredient groups in meal plans', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      { 
        _id: 'p1', 
        name: 'Week A', 
        templateId: 't1', 
        templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
        items: [{
          _id: 'item-1',
          mealPlanId: 'p1',
          dayOfWeek: 'saturday',
          mealType: 'breakfast',
          items: [
            { 
              type: 'ingredientGroup', 
              id: 'group-1', 
              name: 'Smoothie',
              ingredients: [{
                title: 'Smoothie',
                ingredients: [
                  { type: 'foodItem', id: '507f1f77bcf86cd799439011', quantity: 1, unit: 'piece' },
                  { type: 'foodItem', id: '507f1f77bcf86cd799439012', quantity: 2, unit: 'cup' }
                ]
              }]
            }
          ]
        }],
        createdAt: new Date() 
      },
    ]);
    
    const res = await routes.GET(makeReq('http://localhost/api/meal-plans'));
    expect(res.status).toBe(200);
    const json = await res.json();
    const ingredientGroup = json[0].items[0].items[0];
    expect(ingredientGroup.type).toBe('ingredientGroup');
    expect(ingredientGroup.ingredients[0].ingredients[0].name).toBe('apple'); // Singular
    expect(ingredientGroup.ingredients[0].ingredients[1].name).toBe('cups of rice'); // Plural
  });

  it('GET handles missing food items gracefully', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      { 
        _id: 'p1', 
        name: 'Week A', 
        templateId: 't1', 
        templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
        items: [{
          _id: 'item-1',
          mealPlanId: 'p1',
          dayOfWeek: 'saturday',
          mealType: 'breakfast',
          items: [
            // Valid ObjectId but not in our mocks (simulates deleted food item with stored name)
            { type: 'foodItem', id: '507f1f77bcf86cd799439999', quantity: 1, unit: 'cup', name: 'Old Name' },
            // No stored name - should show Unknown
            { type: 'foodItem', id: '507f1f77bcf86cd799439998', quantity: 1, unit: 'cup' }
          ]
        }],
        createdAt: new Date() 
      },
    ]);
    
    const res = await routes.GET(makeReq('http://localhost/api/meal-plans'));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Should keep stored name as fallback when food item is deleted but name was stored
    expect(json[0].items[0].items[0].name).toBe('Old Name');
    // Should show 'Unknown' when no name was stored
    expect(json[0].items[0].items[1].name).toBe('Unknown');
  });

  it('GET filters by startDate and endDate when provided', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      {
        _id: 'p1',
        name: 'Feb Week 1',
        startDate: '2026-02-07',
        endDate: '2026-02-13',
        templateId: 't1',
        templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
        items: [],
        createdAt: new Date()
      },
    ]);

    const res = await routes.GET(makeReq('http://localhost/api/meal-plans?startDate=2026-02-01&endDate=2026-02-28'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe('Feb Week 1');

    // Verify filter was applied to MongoDB query
    const filterArg = findMock.mock.calls[findMock.mock.calls.length - 1][0];
    expect(filterArg.startDate).toEqual({ $gte: '2026-02-01', $lte: '2026-02-28' });
  });

  it('GET filters by minEndDate when provided', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      {
        _id: 'p1',
        name: 'Current Week',
        startDate: '2026-02-16',
        endDate: '2026-02-22',
        templateId: 't1',
        templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
        items: [],
        createdAt: new Date()
      },
    ]);

    const res = await routes.GET(makeReq('http://localhost/api/meal-plans?minEndDate=2026-02-21'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe('Current Week');

    // Verify endDate filter was applied to MongoDB query
    const filterArg = findMock.mock.calls[findMock.mock.calls.length - 1][0];
    expect(filterArg.endDate).toEqual({ $gte: '2026-02-21' });
  });

  it('GET returns all plans when no date filters provided', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      {
        _id: 'p1',
        name: 'Week A',
        templateId: 't1',
        templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
        items: [],
        createdAt: new Date()
      },
    ]);

    const res = await routes.GET(makeReq('http://localhost/api/meal-plans'));
    expect(res.status).toBe(200);

    // Verify no startDate filter was applied
    const filterArg = findMock.mock.calls[findMock.mock.calls.length - 1][0];
    expect(filterArg.startDate).toBeUndefined();
  });
});
