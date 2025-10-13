import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const updateOneMock = vi.fn();
const deleteOneMock = vi.fn();

// Mock food items and recipes for name population (using valid ObjectId format)
const mockFoodItems = {
  '507f1f77bcf86cd799439011': { _id: '507f1f77bcf86cd799439011', singularName: 'banana', pluralName: 'bananas', unit: 'piece' },
  '507f1f77bcf86cd799439012': { _id: '507f1f77bcf86cd799439012', singularName: 'tomato', pluralName: 'tomatoes', unit: 'piece' },
};

const mockRecipes = {
  '507f1f77bcf86cd799439021': { _id: '507f1f77bcf86cd799439021', title: 'Spaghetti Bolognese' },
};

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'mealPlans') {
          return {
            findOne: findOneMock,
            updateOne: updateOneMock,
            deleteOne: deleteOneMock,
          };
        }
        if (name === 'foodItems') {
          return {
            findOne: vi.fn((query: any) => {
              const id = query._id?.toString();
              return Promise.resolve(mockFoodItems[id as keyof typeof mockFoodItems] || null);
            }),
          };
        }
        if (name === 'recipes') {
          return {
            findOne: vi.fn((query: any) => {
              const id = query._id?.toString();
              return Promise.resolve(mockRecipes[id as keyof typeof mockRecipes] || null);
            }),
          };
        }
        if (name === 'users') {
          return {
            findOne: vi.fn().mockResolvedValue(null), // No shared access by default
          };
        }
        return {
          findOne: findOneMock,
          updateOne: updateOneMock,
          deleteOne: deleteOneMock,
        };
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
  findOneMock.mockReset();
  updateOneMock.mockReset();
  deleteOneMock.mockReset();
});

describe('api/meal-plans/[id] route', () => {
  it('GET returns 404 when not found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce(null);
    const res = await routes.GET(makeReq('http://localhost/api/meal-plans/x'), { params: Promise.resolve({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }) } as any);
    expect(res.status).toBe(404);
  });

  it('PUT updates meal plan when valid', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce({ _id: 'p1', userId: 'u1', templateId: 't1', templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } }, createdAt: new Date() });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });
    findOneMock.mockResolvedValueOnce({ _id: 'p1', userId: 'u1', templateId: 't1', templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } }, createdAt: new Date() });
    const res = await routes.PUT(makeReq('http://localhost/api/meal-plans/p1', { name: 'Updated' }), { params: Promise.resolve({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }) } as any);
    expect(res.status).toBe(200);
  });

  it('DELETE requires auth', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.DELETE(makeReq('http://localhost/api/meal-plans/p1'), { params: Promise.resolve({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }) } as any);
    expect(res.status).toBe(401);
  });

  it('GET populates food item names in meal plan', async () => {
    const validMealPlanId = '64b7f8c2a2b7c2f1a2b7c2f1';
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce({ 
      _id: validMealPlanId, 
      userId: 'u1', 
      templateId: 't1', 
      templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
      items: [{
        _id: 'item-1',
        mealPlanId: validMealPlanId,
        dayOfWeek: 'saturday',
        mealType: 'breakfast',
        items: [
          { type: 'foodItem', id: '507f1f77bcf86cd799439011', quantity: 3, unit: 'piece' }
        ]
      }],
      createdAt: new Date() 
    });
    
    const res = await routes.GET(makeReq(`http://localhost/api/meal-plans/${validMealPlanId}`), { params: Promise.resolve({ id: validMealPlanId }) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items[0].items[0].name).toBe('bananas'); // Plural
  });

  it('GET populates recipe names in meal plan', async () => {
    const validMealPlanId = '64b7f8c2a2b7c2f1a2b7c2f2';
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce({ 
      _id: validMealPlanId, 
      userId: 'u1', 
      templateId: 't1', 
      templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
      items: [{
        _id: 'item-1',
        mealPlanId: validMealPlanId,
        dayOfWeek: 'saturday',
        mealType: 'dinner',
        items: [
          { type: 'recipe', id: '507f1f77bcf86cd799439021', quantity: 1 }
        ]
      }],
      createdAt: new Date() 
    });
    
    const res = await routes.GET(makeReq(`http://localhost/api/meal-plans/${validMealPlanId}`), { params: Promise.resolve({ id: validMealPlanId }) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items[0].items[0].name).toBe('Spaghetti Bolognese');
  });

  it('GET populates ingredient group names in meal plan', async () => {
    const validMealPlanId = '64b7f8c2a2b7c2f1a2b7c2f3';
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce({ 
      _id: validMealPlanId, 
      userId: 'u1', 
      templateId: 't1', 
      templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true }, weeklyStaples: [] },
      items: [{
        _id: 'item-1',
        mealPlanId: validMealPlanId,
        dayOfWeek: 'saturday',
        mealType: 'lunch',
        items: [
          { 
            type: 'ingredientGroup', 
            id: 'group-1', 
            name: 'Salad',
            ingredients: [{
              title: 'Salad',
              ingredients: [
                { type: 'foodItem', id: '507f1f77bcf86cd799439012', quantity: 4, unit: 'piece' },
                { type: 'recipe', id: '507f1f77bcf86cd799439021', quantity: 1 }
              ]
            }]
          }
        ]
      }],
      createdAt: new Date() 
    });
    
    const res = await routes.GET(makeReq(`http://localhost/api/meal-plans/${validMealPlanId}`), { params: Promise.resolve({ id: validMealPlanId }) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    const ingredientGroup = json.items[0].items[0];
    expect(ingredientGroup.type).toBe('ingredientGroup');
    expect(ingredientGroup.ingredients[0].ingredients[0].name).toBe('tomatoes'); // Plural
    expect(ingredientGroup.ingredients[0].ingredients[1].name).toBe('Spaghetti Bolognese');
  });

  it('GET populates staples names in meal plan', async () => {
    const validMealPlanId = '64b7f8c2a2b7c2f1a2b7c2f4';
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce({ 
      _id: validMealPlanId, 
      userId: 'u1', 
      templateId: 't1', 
      templateSnapshot: { 
        startDay: 'saturday', 
        meals: { breakfast: true, lunch: true, dinner: true }, 
        weeklyStaples: [
          { type: 'foodItem', id: '507f1f77bcf86cd799439011', quantity: 1, unit: 'piece' }
        ] 
      },
      items: [{
        _id: 'item-staples',
        mealPlanId: validMealPlanId,
        dayOfWeek: 'saturday',
        mealType: 'staples',
        items: [
          { type: 'foodItem', id: '507f1f77bcf86cd799439011', quantity: 1, unit: 'piece' }
        ]
      }],
      createdAt: new Date() 
    });
    
    const res = await routes.GET(makeReq(`http://localhost/api/meal-plans/${validMealPlanId}`), { params: Promise.resolve({ id: validMealPlanId }) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    const staplesItem = json.items.find((item: any) => item.mealType === 'staples');
    expect(staplesItem).toBeDefined();
    expect(staplesItem.items[0].name).toBe('banana'); // Singular
  });
});


