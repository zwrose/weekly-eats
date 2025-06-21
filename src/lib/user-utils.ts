import { getMongoClient } from './mongodb';
import { ObjectId } from 'mongodb';

export const getUserObjectId = async (email: string): Promise<ObjectId | null> => {
  const client = await getMongoClient();
  const db = client.db();
  const usersCollection = db.collection('users');
  
  const user = await usersCollection.findOne({ email });
  return user?._id || null;
}; 