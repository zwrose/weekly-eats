import { NextResponse } from 'next/server';
import Ably from 'ably';

let restClient: Ably.Rest | null = null;

function getRestClient(): Ably.Rest | null {
  if (restClient) {
    return restClient;
  }

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    console.error('[Ably] ABLY_API_KEY is not set');
    return null;
  }

  restClient = new Ably.Rest(apiKey);
  return restClient;
}

export async function GET() {
  const client = getRestClient();
  if (!client) {
    return NextResponse.json({ error: 'Ably not configured' }, { status: 500 });
  }

  try {
    const tokenRequest = await new Promise<Ably.Types.TokenRequest>((resolve, reject) => {
      client.auth.createTokenRequest(
        { clientId: 'weekly-eats' },
        (err, result) => {
          if (err) return reject(err);
          if (!result) return reject(new Error('No token request returned'));
          resolve(result);
        }
      );
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('[Ably] Failed to create token request:', error);
    return NextResponse.json({ error: 'Failed to create Ably token' }, { status: 500 });
  }
}



