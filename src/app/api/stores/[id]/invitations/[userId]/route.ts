import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS, STORE_ERRORS, STORE_INVITATION_ERRORS, logError } from '@/lib/errors';

type RouteParams = {
  params: Promise<{ id: string; userId: string }>;
};

// Accept or reject invitation
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id, userId } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: STORE_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body; // 'accept' or 'reject'

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: STORE_INVITATION_ERRORS.INVALID_ACTION }, { status: 400 });
    }

    // Only the invited user can accept/reject their invitation
    if (userId !== session.user.id) {
      return NextResponse.json({ error: STORE_INVITATION_ERRORS.NOT_AUTHORIZED }, { status: 403 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');

    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(id),
      'invitations.userId': userId,
      'invitations.status': 'pending'
    });

    if (!store) {
      return NextResponse.json({ error: STORE_INVITATION_ERRORS.INVITATION_NOT_FOUND }, { status: 404 });
    }

    // Update invitation status
    await storesCollection.updateOne(
      { 
        _id: ObjectId.createFromHexString(id),
        'invitations.userId': userId
      },
      { 
        $set: { 
          'invitations.$.status': action === 'accept' ? 'accepted' : 'rejected',
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Store Invitation PUT', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

// Remove user from store (owner removes user OR user leaves)
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id, userId } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: STORE_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');

    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(id)
    });

    if (!store) {
      return NextResponse.json({ error: STORE_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Allow if user is owner OR if user is removing themselves
    const isOwner = store.userId === session.user.id;
    const isSelf = userId === session.user.id;

    if (!isOwner && !isSelf) {
      return NextResponse.json({ error: STORE_INVITATION_ERRORS.NOT_AUTHORIZED }, { status: 403 });
    }

    // Remove the invitation
    await storesCollection.updateOne(
      { _id: ObjectId.createFromHexString(id) },
      { 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $pull: { invitations: { userId } } as any,
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Store Invitation DELETE', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

