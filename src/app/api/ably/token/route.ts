import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import Ably from 'ably';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS, logError } from '@/lib/errors';

let restClient: Ably.Rest | null = null;

function getRestClient(): Ably.Rest | null {
  if (restClient) {
    return restClient;
  }

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    logError('Ably', new Error('ABLY_API_KEY is not set'));
    return null;
  }

  restClient = new Ably.Rest(apiKey);
  return restClient;
}

// Operations the realtime client needs per shopping-store channel: it subscribes
// to messages + presence and enters presence. It never publishes (the server
// publishes via the API key directly), so we never grant 'publish' to clients.
const CHANNEL_OPS = ['subscribe', 'presence'];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
  }

  const client = getRestClient();
  if (!client) {
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }

  try {
    // Scope the token to only the shopping-store channels this user may access:
    // stores they own + stores where they hold an accepted invitation. This
    // mirrors the membership gate enforced on every shopping-list REST route and
    // prevents a client from subscribing to another user's store channel.
    const db = (await getMongoClient()).db();
    const stores = await db
      .collection('stores')
      .find(
        {
          $or: [
            { userId: session.user.id },
            { 'invitations.userId': session.user.id, 'invitations.status': 'accepted' },
          ],
        },
        { projection: { _id: 1 } }
      )
      .toArray();

    const capability: Record<string, string[]> = {};
    for (const store of stores) {
      capability[`shopping-store:${store._id.toString()}`] = CHANNEL_OPS;
    }
    // A user with no accessible stores still needs a valid (but empty-of-data)
    // token; scope it to their own private namespace, which nothing publishes to.
    if (Object.keys(capability).length === 0) {
      capability[`user:${session.user.id}`] = ['subscribe'];
    }

    const tokenRequest = await new Promise<Ably.Types.TokenRequest>((resolve, reject) => {
      client.auth.createTokenRequest(
        { clientId: 'weekly-eats', capability: JSON.stringify(capability) },
        (err, result) => {
          if (err) return reject(err);
          if (!result) return reject(new Error('No token request returned'));
          resolve(result);
        }
      );
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    logError('Ably Token GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
