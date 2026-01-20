import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { 
  AUTH_ERRORS, 
  RECIPE_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';
import { RecipeSharingInvitation } from '@/lib/user-settings';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id: recipeId } = await params;
    if (!ObjectId.isValid(recipeId)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');
    const recipeUserDataCollection = db.collection('recipeUserData');
    const usersCollection = db.collection('users');

    // Verify recipe exists and is accessible
    const recipe = await recipesCollection.findOne({
      _id: ObjectId.createFromHexString(recipeId),
      $or: [
        { isGlobal: true },
        { createdBy: session.user.id }
      ]
    });

    if (!recipe) {
      return NextResponse.json({ error: RECIPE_ERRORS.RECIPE_NOT_FOUND }, { status: 404 });
    }

    // Get user's own data
    const userData = await recipeUserDataCollection.findOne({
      userId: session.user.id,
      recipeId: recipeId
    });

    const tags = userData?.tags || [];
    const rating = userData?.rating;

    // Get users who have shared recipe data with current user
    const sharingOwners = await usersCollection
      .find({
        'settings.recipeSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'accepted'
          }
        }
      })
      .toArray();

    // Collect shared tags and ratings
    const sharedTagsSet = new Set<string>();
    const sharedRatings: Array<{ userId: string; userName?: string; userEmail: string; rating: number }> = [];

    for (const owner of sharingOwners) {
      const invitations = (owner.settings as { recipeSharing?: { invitations?: RecipeSharingInvitation[] } })?.recipeSharing?.invitations || [];
      const invitation = invitations.find(
        (inv: RecipeSharingInvitation) => inv.userId === session.user.id && inv.status === 'accepted'
      );

      if (!invitation) continue;

      // Get shared data if tags or ratings are shared
      if (invitation.sharingTypes.includes('tags') || invitation.sharingTypes.includes('ratings')) {
        const ownerUserData = await recipeUserDataCollection.findOne({
          userId: owner._id.toString(),
          recipeId: recipeId
        });

        if (ownerUserData) {
          // Add shared tags if tags sharing is enabled
          if (invitation.sharingTypes.includes('tags') && ownerUserData.tags) {
            ownerUserData.tags.forEach((tag: string) => sharedTagsSet.add(tag));
          }

          // Add shared rating if ratings sharing is enabled
          if (invitation.sharingTypes.includes('ratings') && ownerUserData.rating) {
            sharedRatings.push({
              userId: owner._id.toString(),
              userName: owner.name,
              userEmail: owner.email,
              rating: ownerUserData.rating
            });
          }
        }
      }
    }

    const sharedTags = Array.from(sharedTagsSet);

    return NextResponse.json({
      tags,
      rating,
      sharedTags: sharedTags.length > 0 ? sharedTags : undefined,
      sharedRatings: sharedRatings.length > 0 ? sharedRatings : undefined
    });
  } catch (error) {
    logError('Recipes User Data GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

