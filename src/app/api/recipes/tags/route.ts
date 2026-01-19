import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '@/lib/mongodb';
import { 
  AUTH_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

/**
 * GET /api/recipes/tags
 * Returns all unique tags for the current user across all their recipes
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipeUserDataCollection = db.collection('recipeUserData');

    // Get all user data for the current user
    const userDataList = await recipeUserDataCollection
      .find({ userId: session.user.id })
      .toArray();

    // Collect all unique tags
    const tagsSet = new Set<string>();
    for (const userData of userDataList) {
      if (userData.tags && Array.isArray(userData.tags)) {
        for (const tag of userData.tags) {
          if (typeof tag === 'string' && tag.trim().length > 0) {
            tagsSet.add(tag.trim());
          }
        }
      }
    }

    // Convert to sorted array
    const tags = Array.from(tagsSet).sort();

    return NextResponse.json({ tags });
  } catch (error) {
    logError('Recipes Tags GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

