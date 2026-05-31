import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMock = vi.fn();
const sortMock = vi.fn();
const skipMock = vi.fn();
const limitMock = vi.fn();
const toArrayMock = vi.fn();
const countDocumentsMock = vi.fn();
const insertOneMock = vi.fn();
const updateOneMock = vi.fn();
const findOneMock = vi.fn();
const aggregateMock = vi.fn();
const aggregateToArrayMock = vi.fn();
const foodItemsFindMock = vi.fn();

function resetChain() {
  limitMock.mockReturnValue({ toArray: toArrayMock });
  skipMock.mockReturnValue({ limit: limitMock });
  sortMock.mockReturnValue({ skip: skipMock });
  findMock.mockReturnValue({ sort: sortMock });
  aggregateMock.mockReturnValue({ toArray: aggregateToArrayMock });
  foodItemsFindMock.mockReturnValue({ toArray: () => Promise.resolve([]) });
}

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'foodItems') {
          return { find: foodItemsFindMock };
        }
        return {
          find: findMock,
          aggregate: aggregateMock,
          countDocuments: countDocumentsMock,
          insertOne: insertOneMock,
          updateOne: updateOneMock,
          findOne: findOneMock,
        };
      },
    }),
  })),
}));

const { searchRecipes, getRecipe, createRecipe, updateRecipe } =
  await import('@/lib/services/recipes');
const { ValidationError, NotFoundError } = await import('@/lib/service-errors');

const pagination = { page: 1, limit: 10, sortBy: 'updatedAt', sortOrder: -1 as const };

beforeEach(() => {
  findMock.mockReset();
  sortMock.mockReset();
  skipMock.mockReset();
  limitMock.mockReset();
  toArrayMock.mockReset();
  countDocumentsMock.mockReset();
  insertOneMock.mockReset();
  updateOneMock.mockReset();
  findOneMock.mockReset();
  aggregateMock.mockReset();
  aggregateToArrayMock.mockReset();
  foodItemsFindMock.mockReset();
  resetChain();
});

describe('searchRecipes', () => {
  it('scopes the default query to global OR the caller and annotates accessLevel', async () => {
    toArrayMock.mockResolvedValueOnce([
      { _id: 'r1', title: 'Mine', createdBy: 'u1', isGlobal: false },
      { _id: 'r2', title: 'SharedByMe', createdBy: 'u1', isGlobal: true },
      { _id: 'r3', title: 'Others', createdBy: 'u2', isGlobal: true },
    ]);
    countDocumentsMock.mockResolvedValueOnce(3);

    const result = await searchRecipes('u1', { pagination });

    const filter = findMock.mock.calls[0][0];
    expect(filter.$or).toContainEqual({ isGlobal: true });
    expect(filter.$or).toContainEqual({ createdBy: 'u1' });
    expect(result.data[0].accessLevel).toBe('private');
    expect(result.data[1].accessLevel).toBe('shared-by-you');
    expect(result.data[2].accessLevel).toBe('shared-by-others');
  });

  it('retains the ownership scope under text search on the simple find path', async () => {
    toArrayMock.mockResolvedValueOnce([]);
    countDocumentsMock.mockResolvedValueOnce(0);

    await searchRecipes('u1', { query: 'pizza', pagination });

    // No tags/ratings → simple find() path (not aggregation).
    expect(aggregateMock).not.toHaveBeenCalled();
    const filter = findMock.mock.calls[0][0];
    // Text search wraps the base filter in $and; $and[0] is the ownership scope.
    expect(filter.$and[0]).toEqual({ $or: [{ isGlobal: true }, { createdBy: 'u1' }] });
    expect(filter.$and[0].$or).toContainEqual({ createdBy: 'u1' });
  });

  it('uses the aggregation path when tags are provided', async () => {
    aggregateToArrayMock.mockResolvedValueOnce([
      {
        total: 1,
        data: [{ _id: 'r1', title: 'Tagged', createdBy: 'u1', isGlobal: false }],
      },
    ]);
    const result = await searchRecipes('u1', { tags: ['italian'], pagination });
    expect(aggregateMock).toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.data[0].accessLevel).toBe('private');
  });
});

describe('getRecipe', () => {
  it('throws ValidationError for a malformed id', async () => {
    await expect(getRecipe('u1', 'bad-id')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError when missing', async () => {
    findOneMock.mockResolvedValueOnce(null);
    await expect(getRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1')).rejects.toBeInstanceOf(NotFoundError);
  });

  // Ownership-rejection test (§8a). The recipe domain folds "not owned / not
  // visible" into NotFoundError by design (the query carries the visibility
  // predicate, so an unowned private recipe returns null) — it does NOT throw
  // ForbiddenError like the food-item domain. Asserting the query is scoped
  // means a regression that drops the predicate is caught.
  it("throws NotFoundError for another user's private recipe and scopes the query to the caller", async () => {
    findOneMock.mockResolvedValueOnce(null);
    await expect(getRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1')).rejects.toBeInstanceOf(NotFoundError);
    const filter = findOneMock.mock.calls[0][0];
    expect(filter.$or).toContainEqual({ isGlobal: true });
    expect(filter.$or).toContainEqual({ createdBy: 'u1' });
  });

  it('returns the recipe with resolved ingredient names', async () => {
    const { ObjectId } = await import('mongodb');
    const foodItemId = '64b7f8c2a2b7c2f1a2b7c2f2';
    findOneMock.mockResolvedValueOnce({
      _id: '64b7f8c2a2b7c2f1a2b7c2f1',
      title: 'Test',
      createdBy: 'u1',
      isGlobal: false,
      ingredients: [
        {
          isStandalone: true,
          ingredients: [{ type: 'foodItem', id: foodItemId, quantity: 2, unit: 'cup' }],
        },
      ],
    });
    foodItemsFindMock.mockReturnValueOnce({
      toArray: () =>
        Promise.resolve([
          {
            _id: ObjectId.createFromHexString(foodItemId),
            singularName: 'Tomato',
            pluralName: 'Tomatoes',
          },
        ]),
    });
    const recipe = await getRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1');
    expect(recipe.ingredients[0].ingredients[0].name).toBe('Tomatoes');
    // Prove the foodItems collection was actually queried (by $in of the
    // ingredient id) — i.e. the name was resolved, not coincidentally present.
    expect(foodItemsFindMock).toHaveBeenCalledTimes(1);
    const foodItemsFilter = foodItemsFindMock.mock.calls[0][0];
    expect(JSON.stringify(foodItemsFilter)).toContain(foodItemId);
  });
});

describe('createRecipe', () => {
  it('throws ValidationError when the title is missing', async () => {
    await expect(
      createRecipe('u1', { title: '', instructions: 'x', isGlobal: false, ingredients: [] })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when there are no ingredients', async () => {
    await expect(
      createRecipe('u1', { title: 'T', instructions: 'x', isGlobal: false, ingredients: [] })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('inserts a recipe scoped to the caller and returns it', async () => {
    insertOneMock.mockResolvedValueOnce({ insertedId: 'new-id' });
    const created = await createRecipe('u1', {
      title: 'My Recipe',
      instructions: 'Cook it',
      isGlobal: false,
      ingredients: [
        { title: 'G', ingredients: [{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }] },
      ],
    });
    expect(insertOneMock).toHaveBeenCalledTimes(1);
    expect(created.createdBy).toBe('u1');
    expect(created._id).toBe('new-id');
    // Assert the PERSISTED document (the insertOne argument), not just the
    // returned value — a regression that stops stamping createdBy/timestamps
    // on the inserted doc would otherwise slip through.
    const insertedDoc = insertOneMock.mock.calls[0][0];
    expect(insertedDoc.createdBy).toBe('u1');
    expect(insertedDoc.createdAt).toBeInstanceOf(Date);
    expect(insertedDoc.updatedAt).toBeInstanceOf(Date);
  });
});

describe('updateRecipe', () => {
  it('throws ValidationError for a malformed id', async () => {
    await expect(updateRecipe('u1', 'bad', { title: 'X' })).rejects.toBeInstanceOf(ValidationError);
  });

  // Ownership-rejection test (§8a). updateRecipe queries
  // { _id, createdBy: userId }; a non-owner match returns null → NotFoundError
  // (mirrors the existing route's RECIPE_ERRORS.NO_PERMISSION_TO_EDIT behavior).
  // Asserts the ownership predicate is in the query so a regression is caught.
  it('throws NotFoundError when the caller does not own the recipe and scopes the lookup by createdBy', async () => {
    findOneMock.mockResolvedValueOnce(null);
    await expect(
      updateRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1', { title: 'X' })
    ).rejects.toBeInstanceOf(NotFoundError);
    const filter = findOneMock.mock.calls[0][0];
    expect(filter.createdBy).toBe('u1');
  });

  it('allowlists fields — never $sets createdBy/_id/createdAt', async () => {
    findOneMock.mockResolvedValueOnce({ _id: 'x', createdBy: 'u1' });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });
    findOneMock.mockResolvedValueOnce({ _id: 'x', createdBy: 'u1', title: 'New' });
    await updateRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1', {
      title: 'New',
      // @ts-expect-error attacker-injected fields are not in the input type
      createdBy: 'someone-else',
      _id: 'forged',
    });
    const setArg = updateOneMock.mock.calls[0][1].$set;
    expect(setArg).not.toHaveProperty('createdBy');
    expect(setArg).not.toHaveProperty('_id');
    expect(setArg).not.toHaveProperty('createdAt');
    expect(setArg.title).toBe('New');
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });
});
