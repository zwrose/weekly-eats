import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { PANTRY_ERRORS, logError } from '@/lib/errors';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: PANTRY_ERRORS.PANTRY_ITEM_NOT_FOUND },
        { status: 401 }
      );
    }

    const client = await getMongoClient();
    const db = client.db();
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: PANTRY_ERRORS.PANTRY_ITEM_NOT_FOUND },
        { status: 400 }
      );
    }

    // Verify the pantry item exists and belongs to the user
    const pantryItem = await db.collection('pantry').findOne({
      _id: new ObjectId(id),
      userId: session.user.id
    });

    if (!pantryItem) {
      return NextResponse.json(
        { error: PANTRY_ERRORS.PANTRY_ITEM_NOT_FOUND },
        { status: 404 }
      );
    }

    // Delete the pantry item
    const result = await db.collection('pantry').deleteOne({
      _id: new ObjectId(id),
      userId: session.user.id
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: PANTRY_ERRORS.PANTRY_ITEM_NOT_FOUND },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    logError('Pantry DELETE', error);
    return NextResponse.json(
      { error: PANTRY_ERRORS.PANTRY_ITEM_DELETION_FAILED },
      { status: 500 }
    );
  }
} 