import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  getActiveUsers,
  broadcastPresence,
  addConnection,
  removeConnection
} from '@/lib/shopping-sync-broadcast';

// Re-export broadcastToStore for backward compatibility
export { broadcastToStore } from '@/lib/shopping-sync-broadcast';

/**
 * Helper to get all user IDs with access to a store
 */
async function getUsersWithAccess(storeId: string): Promise<string[]> {
  try {
    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');

    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(storeId)
    });

    if (!store) return [];

    const userIds = [store.userId]; // Owner

    // Add users with accepted invitations
    const acceptedInvitations = store.invitations?.filter(
      (inv: { status: string }) => inv.status === 'accepted'
    ) || [];

    acceptedInvitations.forEach((inv: { userId: string }) => {
      userIds.push(inv.userId);
    });

    return userIds;
  } catch (error) {
    console.error('Error getting users with access:', error);
    return [];
  }
}


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId || !ObjectId.isValid(storeId)) {
      return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
    }

    // Verify user has access to this store
    const usersWithAccess = await getUsersWithAccess(storeId);
    if (!usersWithAccess.includes(session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Add this user's connection
        addConnection(
          storeId,
          session.user!.id,
          controller,
          session.user!.email!,
          session.user!.name || session.user!.email!
        );

        // Send initial presence to the new user
        const activeUsers = getActiveUsers(storeId);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'presence',
          activeUsers,
          timestamp: new Date().toISOString()
        })}\n\n`));

        // Broadcast presence update to all users (including new user)
        broadcastPresence(storeId);

        // Send keepalive ping every 30 seconds
        const keepAliveInterval = setInterval(() => {
          try {
            if (request.signal.aborted) {
              clearInterval(keepAliveInterval);
              return;
            }
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
          } catch (error) {
            console.error('Error sending keepalive:', error);
            clearInterval(keepAliveInterval);
          }
        }, 30000);

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          
          // Remove this connection
          removeConnection(storeId, session.user!.id);
          
          // Broadcast updated presence
          broadcastPresence(storeId);
          
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      }
    });
  } catch (error) {
    console.error('Error setting up shopping list SSE stream:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

