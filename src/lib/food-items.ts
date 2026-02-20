import { getMongoClient } from './mongodb';
import { ObjectId } from 'mongodb';
import { ValidUnit } from './food-items-utils';

export interface FoodItem {
  _id?: ObjectId;
  name: string;
  unit?: ValidUnit;
  isGlobal: boolean;
  userId?: ObjectId; // Only set for user-scoped items
  createdBy: ObjectId; // ObjectId of user who created it
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFoodItemData {
  name: string;
  unit?: ValidUnit;
  isGlobal: boolean;
}

export const getFoodItemsCollection = async () => {
  const client = await getMongoClient();
  const db = client.db();
  return db.collection<FoodItem>('food_items');
};

export const createFoodItem = async (data: CreateFoodItemData, userId: ObjectId): Promise<FoodItem> => {
  const collection = await getFoodItemsCollection();
  
  const foodItem: FoodItem = {
    ...data,
    userId: data.isGlobal ? undefined : userId,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(foodItem);
  return { ...foodItem, _id: result.insertedId };
};

export const getFoodItemById = async (id: string): Promise<FoodItem | null> => {
  const collection = await getFoodItemsCollection();
  return await collection.findOne({ _id: ObjectId.createFromHexString(id) });
};

export const getFoodItemByName = async (name: string, userId?: ObjectId): Promise<FoodItem | null> => {
  const collection = await getFoodItemsCollection();
  
  const query = {
    name: { $regex: new RegExp(`^${name}$`, 'i') },
    $or: [
      { isGlobal: true },
      ...(userId ? [{ userId }] : [])
    ]
  };
  
  return await collection.findOne(query);
};

export const searchFoodItems = async (query: string, userId: ObjectId, limit: number = 10): Promise<FoodItem[]> => {
  const collection = await getFoodItemsCollection();
  
  const searchQuery = {
    name: { $regex: query, $options: 'i' },
    $or: [
      { isGlobal: true },
      { userId }
    ]
  };

  return await collection
    .find(searchQuery)
    .sort({ name: 1 })
    .limit(limit)
    .toArray();
};

export const getAllFoodItems = async (userId: ObjectId): Promise<FoodItem[]> => {
  const collection = await getFoodItemsCollection();
  
  const query = {
    $or: [
      { isGlobal: true },
      { userId }
    ]
  };
  
  return await collection.find(query).sort({ name: 1 }).toArray();
};

export const getUserFoodItems = async (userId: ObjectId): Promise<FoodItem[]> => {
  const collection = await getFoodItemsCollection();
  return await collection
    .find({ userId })
    .sort({ name: 1 })
    .toArray();
};

export const getGlobalFoodItems = async (): Promise<FoodItem[]> => {
  const collection = await getFoodItemsCollection();
  return await collection
    .find({ isGlobal: true })
    .sort({ name: 1 })
    .toArray();
};

export const updateFoodItem = async (id: string, data: Partial<CreateFoodItemData>, userId: ObjectId): Promise<boolean> => {
  const collection = await getFoodItemsCollection();
  
  // Only allow updates if user owns the item or it's global and they created it
  const query = {
    _id: ObjectId.createFromHexString(id),
    $or: [
      { userId },
      { isGlobal: true, createdBy: userId }
    ]
  };
  
  const result = await collection.updateOne(
    query,
    { 
      $set: { 
        ...data,
        userId: data.isGlobal ? undefined : userId,
        updatedAt: new Date() 
      } 
    }
  );
  
  return result.modifiedCount > 0;
};

export const deleteFoodItem = async (id: string, userId: ObjectId): Promise<boolean> => {
  const collection = await getFoodItemsCollection();
  
  // Only allow deletion if user owns the item or it's global and they created it
  const query = {
    _id: ObjectId.createFromHexString(id),
    $or: [
      { userId },
      { isGlobal: true, createdBy: userId }
    ]
  };
  
  const result = await collection.deleteOne(query);
  return result.deletedCount > 0;
}; 