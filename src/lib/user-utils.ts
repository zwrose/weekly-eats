import { getMongoClient } from './mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";

export const getUserObjectId = async (email: string): Promise<ObjectId | null> => {
  const client = await getMongoClient();
  const db = client.db();
  const usersCollection = db.collection('users');
  
  const user = await usersCollection.findOne({ email });
  return user?._id || null;
};

/**
 * Get admin status for the current user (server-side)
 * @returns Promise<boolean> indicating if the current user is an admin
 */
export const getCurrentUserAdminStatus = async (): Promise<boolean> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  
  const client = await getMongoClient();
  const db = client.db();
  const usersCollection = db.collection('users');
  
  const user = await usersCollection.findOne({ email: session.user.email });
  return user?.isAdmin === true;
}; 