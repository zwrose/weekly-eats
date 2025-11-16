import * as Ably from 'ably';

let client: Ably.Realtime | null = null;

export const getAblyClient = (): Ably.Realtime => {
  if (client) {
    return client;
  }

  client = new Ably.Realtime({
    authUrl: '/api/ably/token',
    echoMessages: false,
  });

  return client;
};


