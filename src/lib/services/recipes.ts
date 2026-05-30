import { ObjectId, Document, WithId } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';
import { PaginationParams } from '@/lib/pagination-utils';
import { RECIPE_ERRORS } from '@/lib/errors';
import { ValidationError, NotFoundError } from '@/lib/service-errors';
import type {
  CreateRecipeRequest,
  UpdateRecipeRequest,
  RecipeIngredientList,
} from '@/types/recipe';

type RecipeDoc = WithId<Document>;
type AccessLevel = 'private' | 'shared-by-you' | 'shared-by-others';

export interface SearchRecipesInput {
  query?: string | null;
  accessLevel?: string | null;
  tags?: string[];
  ratings?: number[];
  pagination: PaginationParams;
}

function computeAccessLevel(
  recipe: { createdBy: string; isGlobal: boolean },
  userId: string
): AccessLevel {
  if (recipe.createdBy === userId && !recipe.isGlobal) return 'private';
  if (recipe.createdBy === userId && recipe.isGlobal) return 'shared-by-you';
  return 'shared-by-others';
}

function buildBaseFilter(
  accessLevel: string | null | undefined,
  userId: string
): Record<string, unknown> {
  switch (accessLevel) {
    case 'private':
      return { createdBy: userId, isGlobal: false };
    case 'shared-by-you':
      return { createdBy: userId, isGlobal: true };
    case 'shared-by-others':
      return { isGlobal: true, createdBy: { $ne: userId } };
    default:
      return { $or: [{ isGlobal: true }, { createdBy: userId }] };
  }
}

function addTextSearch(
  filter: Record<string, unknown>,
  query: string | null | undefined
): Record<string, unknown> {
  if (!query || !query.trim()) return filter;
  const searchFilter = {
    $or: [{ title: { $regex: query, $options: 'i' } }, { emoji: { $regex: query, $options: 'i' } }],
  };
  return { $and: [filter, searchFilter] };
}

function validateIngredientLists(ingredients: RecipeIngredientList[]): void {
  let totalIngredients = 0;
  for (const ingredientList of ingredients) {
    if (!ingredientList.ingredients) {
      throw new ValidationError(RECIPE_ERRORS.INGREDIENT_LIST_REQUIRED);
    }
    totalIngredients += ingredientList.ingredients.length;
    if (
      !ingredientList.isStandalone &&
      (!ingredientList.title || ingredientList.title.trim() === '')
    ) {
      throw new ValidationError('Group titles are required for non-standalone ingredient groups');
    }
    for (const ingredient of ingredientList.ingredients) {
      if (
        !ingredient.id ||
        ingredient.quantity <= 0 ||
        (ingredient.type === 'foodItem' && !ingredient.unit)
      ) {
        throw new ValidationError(RECIPE_ERRORS.INVALID_INGREDIENT_DATA);
      }
    }
  }
  if (totalIngredients === 0) {
    throw new ValidationError(RECIPE_ERRORS.INGREDIENT_LIST_REQUIRED);
  }
}

export async function searchRecipes(userId: string, input: SearchRecipesInput) {
  const { query, accessLevel, tags = [], ratings = [], pagination } = input;
  const { page, limit, sortBy, sortOrder } = pagination;

  const client = await getMongoClient();
  const db = client.db();
  const recipesCollection = db.collection('recipes');

  let filter = buildBaseFilter(accessLevel, userId);
  filter = addTextSearch(filter, query);

  const useAggregation = tags.length > 0 || ratings.length > 0 || sortBy === 'rating';

  if (useAggregation) {
    const skip = (page - 1) * limit;
    const pipeline: Record<string, unknown>[] = [
      { $match: filter },
      {
        $lookup: {
          from: 'recipeUserData',
          let: { recipeId: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$recipeId', '$$recipeId'] }, { $eq: ['$userId', userId] }],
                },
              },
            },
          ],
          as: 'userDataArr',
        },
      },
      { $addFields: { userData: { $arrayElemAt: ['$userDataArr', 0] } } },
      { $unset: 'userDataArr' },
    ];

    if (tags.length > 0) {
      pipeline.push({ $match: { 'userData.tags': { $in: tags } } });
    }
    if (ratings.length > 0) {
      pipeline.push({ $match: { 'userData.rating': { $in: ratings } } });
    }

    const sortField = sortBy === 'rating' ? 'userData.rating' : sortBy;
    pipeline.push(
      { $sort: { [sortField]: sortOrder } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      }
    );

    const results = await recipesCollection.aggregate(pipeline).toArray();
    const result = results[0] || { data: [], total: 0 };
    const total = result.total as number;
    const data = (result.data as RecipeDoc[]).map((recipe) => ({
      ...recipe,
      accessLevel: computeAccessLevel(
        { createdBy: recipe.createdBy, isGlobal: recipe.isGlobal },
        userId
      ),
    }));
    return { data, total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
  }

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    recipesCollection
      .find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray(),
    recipesCollection.countDocuments(filter),
  ]);

  const data = docs.map((recipe) => ({
    ...recipe,
    accessLevel: computeAccessLevel(
      { createdBy: recipe.createdBy, isGlobal: recipe.isGlobal },
      userId
    ),
  }));
  return { data, total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}

export async function getRecipe(userId: string, id: string): Promise<RecipeDoc> {
  if (!ObjectId.isValid(id)) {
    throw new ValidationError(RECIPE_ERRORS.INVALID_RECIPE_ID);
  }

  const client = await getMongoClient();
  const db = client.db();
  const recipesCollection = db.collection('recipes');

  const recipe = await recipesCollection.findOne({
    _id: ObjectId.createFromHexString(id),
    $or: [{ isGlobal: true }, { createdBy: userId }],
  });
  if (!recipe) {
    throw new NotFoundError(RECIPE_ERRORS.RECIPE_NOT_FOUND);
  }

  const foodItemIds: string[] = [];
  const recipeIngredientIds: string[] = [];
  for (const group of recipe.ingredients || []) {
    for (const ingredient of group.ingredients || []) {
      if (ingredient.type === 'foodItem' && ingredient.id) foodItemIds.push(ingredient.id);
      else if (ingredient.type === 'recipe' && ingredient.id)
        recipeIngredientIds.push(ingredient.id);
    }
  }

  const [foodItemsDocs, recipesDocs] = await Promise.all([
    foodItemIds.length > 0
      ? db
          .collection('foodItems')
          .find({ _id: { $in: foodItemIds.map((fid) => ObjectId.createFromHexString(fid)) } })
          .toArray()
      : Promise.resolve([]),
    recipeIngredientIds.length > 0
      ? recipesCollection
          .find({
            _id: { $in: recipeIngredientIds.map((rid) => ObjectId.createFromHexString(rid)) },
          })
          .toArray()
      : Promise.resolve([]),
  ]);

  const foodItemsMap = new Map(foodItemsDocs.map((fi) => [fi._id.toString(), fi]));
  const recipesMap = new Map(recipesDocs.map((r) => [r._id.toString(), r]));

  for (const group of recipe.ingredients || []) {
    for (const ingredient of group.ingredients || []) {
      if (ingredient.type === 'foodItem') {
        const fi = foodItemsMap.get(ingredient.id);
        if (fi) ingredient.name = ingredient.quantity === 1 ? fi.singularName : fi.pluralName;
      } else if (ingredient.type === 'recipe') {
        const r = recipesMap.get(ingredient.id);
        if (r) ingredient.name = r.title;
      }
    }
  }

  return recipe;
}

export async function createRecipe(userId: string, input: CreateRecipeRequest): Promise<RecipeDoc> {
  const { title, instructions, ingredients } = input;
  if (!title || !instructions || !ingredients || ingredients.length === 0) {
    throw new ValidationError(RECIPE_ERRORS.TITLE_REQUIRED);
  }
  validateIngredientLists(ingredients);

  const client = await getMongoClient();
  const db = client.db();
  const recipesCollection = db.collection('recipes');

  const now = new Date();
  const recipe = {
    title: input.title,
    emoji: input.emoji,
    ingredients: input.ingredients,
    instructions: input.instructions,
    isGlobal: input.isGlobal ?? false,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const result = await recipesCollection.insertOne(recipe);
  return { ...recipe, _id: result.insertedId };
}

export async function updateRecipe(
  userId: string,
  id: string,
  input: UpdateRecipeRequest
): Promise<RecipeDoc> {
  if (!ObjectId.isValid(id)) {
    throw new ValidationError(RECIPE_ERRORS.INVALID_RECIPE_ID);
  }

  const client = await getMongoClient();
  const db = client.db();
  const recipesCollection = db.collection('recipes');
  const objectId = ObjectId.createFromHexString(id);

  const existingRecipe = await recipesCollection.findOne({ _id: objectId, createdBy: userId });
  if (!existingRecipe) {
    throw new NotFoundError(RECIPE_ERRORS.NO_PERMISSION_TO_EDIT);
  }

  if (input.ingredients) {
    validateIngredientLists(input.ingredients);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updateData.title = input.title;
  if (input.emoji !== undefined) updateData.emoji = input.emoji;
  if (input.ingredients !== undefined) updateData.ingredients = input.ingredients;
  if (input.instructions !== undefined) updateData.instructions = input.instructions;
  if (input.isGlobal !== undefined) updateData.isGlobal = input.isGlobal;

  const result = await recipesCollection.updateOne(
    { _id: objectId, createdBy: userId },
    { $set: updateData }
  );
  if (result.matchedCount === 0) {
    throw new NotFoundError(RECIPE_ERRORS.RECIPE_NOT_FOUND);
  }

  const updatedRecipe = await recipesCollection.findOne({ _id: objectId });
  if (!updatedRecipe) {
    throw new NotFoundError(RECIPE_ERRORS.RECIPE_NOT_FOUND);
  }
  return updatedRecipe;
}
