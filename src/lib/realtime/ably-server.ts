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

export async function publishShoppingEvent(
  storeId: string,
  name: 'item_checked' | 'list_updated' | 'item_deleted',
  data: unknown
) {
  const client = getRestClient();
  if (!client) {
    return;
  }

  try {
    const channel = client.channels.get(`shopping-store:${storeId}`);
    await channel.publish(name, data);
  } catch (error) {
    console.error('[Ably] Failed to publish shopping event:', error);
  }
}


