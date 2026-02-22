import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS, logError } from '@/lib/errors';
import { RecipeSharingInvitation } from '@/lib/user-settings';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const body = await request.json();
    const { recipeIds } = body;

    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      return NextResponse.json({ error: API_ERRORS.BAD_REQUEST }, { status: 400 });
    }

    // Filter to valid ObjectIds only
    const validIds = recipeIds.filter((id: string) => ObjectId.isValid(id));
    if (validIds.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');
    const recipeUserDataCollection = db.collection('recipeUserData');
    const usersCollection = db.collection('users');

    // Batch verify accessible recipes
    const accessibleRecipes = await recipesCollection
      .find({
        _id: { $in: validIds.map((id: string) => ObjectId.createFromHexString(id)) },
        $or: [{ isGlobal: true }, { createdBy: session.user.id }],
      })
      .project({ _id: 1 })
      .toArray();

    const accessibleIdSet = new Set(accessibleRecipes.map((r) => r._id.toString()));

    // Batch fetch user data for all accessible recipes
    const allUserData = await recipeUserDataCollection
      .find({
        userId: session.user.id,
        recipeId: { $in: [...accessibleIdSet] },
      })
      .toArray();

    const userDataByRecipe = new Map(
      allUserData.map((d) => [d.recipeId, { tags: d.tags || [], rating: d.rating }])
    );

    // Fetch sharing owners once (same for all recipes)
    const sharingOwners = await usersCollection
      .find({
        'settings.recipeSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'accepted',
          },
        },
      })
      .toArray();

    // Build shared data lookup if there are sharing owners
    const sharedDataByRecipe = new Map<
      string,
      {
        sharedTags: Set<string>;
        sharedRatings: Array<{
          userId: string;
          userName?: string;
          userEmail: string;
          rating: number;
        }>;
      }
    >();

    if (sharingOwners.length > 0) {
      // Determine which owners share what
      const ownerSharingMap = new Map<
        string,
        { sharesTag: boolean; sharesRating: boolean; name?: string; email: string }
      >();
      for (const owner of sharingOwners) {
        const invitations =
          (owner.settings as { recipeSharing?: { invitations?: RecipeSharingInvitation[] } })
            ?.recipeSharing?.invitations || [];
        const invitation = invitations.find(
          (inv: RecipeSharingInvitation) =>
            inv.userId === session.user.id && inv.status === 'accepted'
        );
        if (invitation) {
          ownerSharingMap.set(owner._id.toString(), {
            sharesTag: invitation.sharingTypes.includes('tags'),
            sharesRating: invitation.sharingTypes.includes('ratings'),
            name: owner.name,
            email: owner.email,
          });
        }
      }

      // Batch fetch all shared user data
      const ownerIds = [...ownerSharingMap.keys()];
      const sharedUserData = await recipeUserDataCollection
        .find({
          userId: { $in: ownerIds },
          recipeId: { $in: [...accessibleIdSet] },
        })
        .toArray();

      // Organize shared data by recipe
      for (const data of sharedUserData) {
        const ownerInfo = ownerSharingMap.get(data.userId);
        if (!ownerInfo) continue;

        if (!sharedDataByRecipe.has(data.recipeId)) {
          sharedDataByRecipe.set(data.recipeId, { sharedTags: new Set(), sharedRatings: [] });
        }
        const entry = sharedDataByRecipe.get(data.recipeId)!;

        if (ownerInfo.sharesTag && data.tags) {
          data.tags.forEach((tag: string) => entry.sharedTags.add(tag));
        }
        if (ownerInfo.sharesRating && data.rating) {
          entry.sharedRatings.push({
            userId: data.userId,
            userName: ownerInfo.name,
            userEmail: ownerInfo.email,
            rating: data.rating,
          });
        }
      }
    }

    // Assemble response
    const result: Record<
      string,
      {
        tags: string[];
        rating?: number;
        sharedTags?: string[];
        sharedRatings?: Array<{
          userId: string;
          userName?: string;
          userEmail: string;
          rating: number;
        }>;
      }
    > = {};

    for (const recipeId of accessibleIdSet) {
      const userData = userDataByRecipe.get(recipeId) || { tags: [], rating: undefined };
      const shared = sharedDataByRecipe.get(recipeId);
      const sharedTags = shared ? [...shared.sharedTags] : [];
      const sharedRatings = shared?.sharedRatings || [];

      result[recipeId] = {
        tags: userData.tags,
        rating: userData.rating,
        ...(sharedTags.length > 0 ? { sharedTags } : {}),
        ...(sharedRatings.length > 0 ? { sharedRatings } : {}),
      };
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    logError('Recipes User Data Batch POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
