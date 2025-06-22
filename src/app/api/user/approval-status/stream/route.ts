import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../../../../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../../lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Get current user's approval status
    const user = await usersCollection.findOne({ email: session.user.email });
    const isApproved = user?.isApproved === true;
    const isAdmin = user?.isAdmin === true;

    // Set up SSE headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial status
        const data = JSON.stringify({ isApproved, isAdmin });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

        // Set up polling to check for changes every 5 seconds
        const pollInterval = setInterval(async () => {
          try {
            // Check if client is still connected
            if (request.signal.aborted) {
              clearInterval(pollInterval);
              controller.close();
              return;
            }

            // Fetch updated user data
            const updatedUser = await usersCollection.findOne({ email: session.user.email });
            const updatedIsApproved = updatedUser?.isApproved === true;
            const updatedIsAdmin = updatedUser?.isAdmin === true;

            // Only send update if status changed
            if (updatedIsApproved !== isApproved || updatedIsAdmin !== isAdmin) {
              const data = JSON.stringify({ 
                isApproved: updatedIsApproved, 
                isAdmin: updatedIsAdmin 
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          } catch (error) {
            console.error('Error polling user status:', error);
          }
        }, 5000); // Poll every 5 seconds

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });
  } catch (error) {
    console.error('Error setting up SSE stream:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 