import { ObjectId } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';

export interface ApprovalFlags {
  isApproved: boolean;
  isAdmin: boolean;
}

/**
 * Live `users` lookup by id (M1). Returns null for a malformed id or an unknown
 * user; coerces missing flags to false (fail-closed). The caller enforces
 * `isApproved || isAdmin`. This is the intentional departure from the
 * JWT-cached web-app pattern — revoked approval takes effect immediately.
 */
export async function lookupApproval(userId: string): Promise<ApprovalFlags | null> {
  if (!ObjectId.isValid(userId)) return null;
  const client = await getMongoClient();
  const user = await client
    .db()
    .collection('users')
    .findOne({ _id: ObjectId.createFromHexString(userId) });
  if (!user) return null;
  return { isApproved: user.isApproved === true, isAdmin: user.isAdmin === true };
}
