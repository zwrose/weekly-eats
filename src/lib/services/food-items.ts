import { ObjectId, Document, WithId } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';
import { paginatedResponse, PaginationParams } from '@/lib/pagination-utils';
import { VALID_UNITS } from '@/lib/food-items-utils';
import { AUTH_ERRORS, FOOD_ITEM_ERRORS } from '@/lib/errors';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/lib/service-errors';

export interface SearchFoodItemsInput {
  query?: string;
  accessLevel?: string | null;
  userOnly?: boolean;
  globalOnly?: boolean;
  excludeUserCreated?: boolean;
  pagination: PaginationParams;
}

export interface GetFoodItemInput {
  id: string;
  isAdmin?: boolean;
}

export interface CreateFoodItemInput {
  name?: string;
  singularName?: string;
  pluralName?: string;
  unit?: string;
  isGlobal?: boolean;
}

type FoodItemDoc = WithId<Document>;

function computeAccessLevel(item: FoodItemDoc, userId: string): string {
  if (item.isGlobal && item.createdBy === userId) return 'shared-by-you';
  if (item.isGlobal) return 'shared-by-others';
  return 'private';
}

export async function searchFoodItems(userId: string, input: SearchFoodItemsInput) {
  const { query = '', accessLevel, userOnly, globalOnly, excludeUserCreated, pagination } = input;

  const client = await getMongoClient();
  const db = client.db();
  const foodItemsCollection = db.collection('foodItems');

  let filter: Record<string, unknown> = {};
  if (accessLevel === 'private' || userOnly) {
    filter.createdBy = userId;
    if (accessLevel === 'private') {
      filter.isGlobal = { $ne: true };
    }
  } else if (accessLevel === 'shared-by-others' || (globalOnly && excludeUserCreated)) {
    filter.isGlobal = true;
    filter.createdBy = { $ne: userId };
  } else if (accessLevel === 'shared-by-you') {
    filter.isGlobal = true;
    filter.createdBy = userId;
  } else if (globalOnly) {
    filter.isGlobal = true;
  } else {
    filter.$or = [{ isGlobal: true }, { createdBy: userId }];
  }

  if (query.trim()) {
    filter = {
      $and: [
        filter,
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { singularName: { $regex: query, $options: 'i' } },
            { pluralName: { $regex: query, $options: 'i' } },
          ],
        },
      ],
    };
  }

  const result = await paginatedResponse(foodItemsCollection, filter, pagination);
  return {
    ...result,
    data: result.data.map((item) => ({
      ...item,
      accessLevel: computeAccessLevel(item, userId),
    })),
  };
}

export async function getFoodItem(userId: string, input: GetFoodItemInput): Promise<FoodItemDoc> {
  const { id, isAdmin = false } = input;
  if (!ObjectId.isValid(id)) {
    throw new ValidationError(FOOD_ITEM_ERRORS.INVALID_FOOD_ITEM_ID);
  }

  const client = await getMongoClient();
  const db = client.db();
  const foodItemsCollection = db.collection('foodItems');

  const foodItem = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
  if (!foodItem) {
    throw new NotFoundError(FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND);
  }
  if (!foodItem.isGlobal && foodItem.createdBy !== userId && !isAdmin) {
    throw new ForbiddenError(AUTH_ERRORS.FORBIDDEN);
  }
  return foodItem;
}

export async function createFoodItem(
  userId: string,
  input: CreateFoodItemInput
): Promise<FoodItemDoc> {
  const { name, singularName, pluralName, unit, isGlobal } = input;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError(FOOD_ITEM_ERRORS.NAME_REQUIRED);
  }
  if (!singularName || typeof singularName !== 'string' || singularName.trim().length === 0) {
    throw new ValidationError(FOOD_ITEM_ERRORS.SINGULAR_NAME_REQUIRED);
  }
  if (!pluralName || typeof pluralName !== 'string' || pluralName.trim().length === 0) {
    throw new ValidationError(FOOD_ITEM_ERRORS.PLURAL_NAME_REQUIRED);
  }
  if (!unit || typeof unit !== 'string' || !VALID_UNITS.includes(unit)) {
    throw new ValidationError(FOOD_ITEM_ERRORS.UNIT_REQUIRED);
  }
  if (typeof isGlobal !== 'boolean') {
    throw new ValidationError(FOOD_ITEM_ERRORS.IS_GLOBAL_REQUIRED);
  }

  const client = await getMongoClient();
  const db = client.db();
  const foodItemsCollection = db.collection('foodItems');

  const trimmedName = name.trim();
  const trimmedSingularName = singularName.trim();
  const trimmedPluralName = pluralName.trim();

  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const existingItem = await foodItemsCollection.findOne({
    $and: [
      {
        $or: [
          { singularName: { $regex: `^${escapeRegex(trimmedSingularName)}$`, $options: 'i' } },
          { pluralName: { $regex: `^${escapeRegex(trimmedPluralName)}$`, $options: 'i' } },
          { singularName: { $regex: `^${escapeRegex(trimmedPluralName)}$`, $options: 'i' } },
          { pluralName: { $regex: `^${escapeRegex(trimmedSingularName)}$`, $options: 'i' } },
        ],
      },
      {
        $or: [{ isGlobal: true }, { isGlobal: false, createdBy: userId }],
      },
    ],
  });

  if (existingItem) {
    throw new ConflictError(
      FOOD_ITEM_ERRORS.FOOD_ITEM_ALREADY_EXISTS,
      `A food item with name "${existingItem.singularName}" or "${existingItem.pluralName}" already exists`
    );
  }

  const now = new Date();
  const newFoodItem = {
    name: trimmedName,
    singularName: trimmedSingularName,
    pluralName: trimmedPluralName,
    unit,
    isGlobal,
    isApproved: true, // auto-approved; no admin approval step exists
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const result = await foodItemsCollection.insertOne(newFoodItem);
  const createdItem = await foodItemsCollection.findOne({ _id: result.insertedId });
  if (!createdItem) {
    // Should never happen — the insert just succeeded.
    throw new NotFoundError(FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND);
  }
  return createdItem;
}
