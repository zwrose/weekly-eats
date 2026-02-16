import type * as AblyTypes from 'ably';

let client: AblyTypes.Realtime | null = null;

export const getAblyClient = async (): Promise<AblyTypes.Realtime> => {
  if (client) {
    return client;
  }

  const Ably = await import('ably');

  client = new Ably.Realtime({
    authUrl: '/api/ably/token',
    echoMessages: false,
  });

  return client;
};
