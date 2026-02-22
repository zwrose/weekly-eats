import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS, logError } from '@/lib/errors';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const mealPlansCollection = db.collection('mealPlans');
    const usersCollection = db.collection('users');

    // Get users who have shared their meal plans with the current user
    const sharedOwners = await usersCollection
      .find({
        'settings.mealPlanSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'accepted',
          },
        },
      })
      .toArray();

    const sharedOwnerIds = sharedOwners.map((owner) => owner._id.toString());

    // Aggregate meal plans by year/month
    const summary = await mealPlansCollection
      .aggregate([
        {
          $match: {
            userId: { $in: [session.user.id, ...sharedOwnerIds] },
          },
        },
        {
          $group: {
            _id: {
              year: { $substr: ['$startDate', 0, 4] },
              month: { $substr: ['$startDate', 5, 2] },
            },
            count: { $sum: 1 },
            earliest: { $min: '$startDate' },
            latest: { $max: '$startDate' },
          },
        },
        {
          $sort: { '_id.year': -1, '_id.month': -1 },
        },
      ])
      .toArray();

    // Transform to cleaner response format
    const result = summary.map((item) => ({
      year: parseInt(item._id.year, 10),
      month: parseInt(item._id.month, 10),
      count: item.count,
      earliest: item.earliest,
      latest: item.latest,
    }));

    return NextResponse.json(result);
  } catch (error) {
    logError('MealPlans Summary GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
