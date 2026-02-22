import { useEffect, useRef, useState, useCallback } from 'react';
import type * as Ably from 'ably';
import { getAblyClient } from '../realtime/ably-client';

export interface ActiveUser {
  email: string;
  name: string;
}

export interface ShoppingListSyncMessage {
  type: 'presence' | 'item_checked' | 'list_updated' | 'item_deleted';
  activeUsers?: ActiveUser[];
  foodItemId?: string;
  checked?: boolean;
  items?: unknown[];
  updatedBy?: string;
  timestamp?: string;
}

export interface UseShoppingSyncOptions {
  storeId: string | null;
  enabled?: boolean;
  presenceUser?: ActiveUser | null;
  onPresenceUpdate?: (users: ActiveUser[]) => void;
  onItemChecked?: (foodItemId: string, checked: boolean, updatedBy: string) => void;
  onListUpdated?: (items: unknown[], updatedBy: string) => void;
  onItemDeleted?: (foodItemId: string, updatedBy: string) => void;
  autoReconnect?: boolean;
}

export type ShoppingSyncConnectionState =
  | 'initialized'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'suspended'
  | 'closing'
  | 'closed'
  | 'failed'
  | 'unknown';

/**
 * Hook to manage Ably-based real-time sync for shopping lists
 */
export function useShoppingSync(options: UseShoppingSyncOptions) {
  const {
    storeId,
    enabled = true,
    presenceUser,
    onPresenceUpdate,
    onItemChecked,
    onListUpdated,
    onItemDeleted,
    autoReconnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ShoppingSyncConnectionState>('unknown');
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null);
  const clientRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.Types.RealtimeChannelCallbacks | null>(null);
  const presenceUserRef = useRef<ActiveUser | null>(presenceUser ?? null);
  const channelNameRef = useRef<string | null>(null);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isConnectingRef = useRef(false);
  const connectRef = useRef<null | (() => Promise<void>)>(null);

  const connectionHandlersRef = useRef<{
    connected?: () => void;
    connecting?: () => void;
    disconnected?: () => void;
    suspended?: () => void;
    failed?: (stateChange: Ably.Types.ConnectionStateChange) => void;
    closed?: () => void;
  }>({});

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef({
    onPresenceUpdate,
    onItemChecked,
    onListUpdated,
    onItemDeleted,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onPresenceUpdate,
      onItemChecked,
      onListUpdated,
      onItemDeleted,
    };
  }, [onPresenceUpdate, onItemChecked, onListUpdated, onItemDeleted]);

  // Keep presenceUser in a ref so we don't need it in connect's dependencies
  useEffect(() => {
    presenceUserRef.current = presenceUser ?? null;
  }, [presenceUser]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const teardownChannel = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    try {
      channel.presence?.leave?.();
      channel.unsubscribe?.();
      channel.presence?.unsubscribe?.();
    } catch (error) {
      console.error('Error unsubscribing from Ably channel:', error);
    }

    channelRef.current = null;
    channelNameRef.current = null;
  }, []);

  const updateConnectionStateFromClient = (client: Ably.Realtime) => {
    const state = (client.connection?.state as ShoppingSyncConnectionState) ?? 'unknown';
    setConnectionState(state);
    setIsConnected(state === 'connected');
  };

  const scheduleReconnect = useCallback(
    (reason: string) => {
      if (!autoReconnect || !enabled || !storeId) return;
      if (reconnectTimerRef.current) return;

      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;

      // Exponential backoff w/ cap and small jitter.
      const baseDelay = Math.min(30_000, 500 * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 250);
      const delay = baseDelay + jitter;

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        setLastConnectionError(`Reconnecting… (${reason})`);
        // Use a ref to avoid TDZ/dependency issues and keep backoff attempts.
        void connectRef.current?.();
      }, delay);
    },
    [autoReconnect, enabled, storeId]
  );

  const installConnectionHandlers = useCallback(
    (client: Ably.Realtime) => {
      // Avoid installing multiple times for this hook instance.
      if (connectionHandlersRef.current.connected) return;

      const handleConnecting = () => {
        setConnectionState('connecting');
        setIsConnected(false);
      };
      const handleConnected = () => {
        clearReconnectTimer();
        reconnectAttemptRef.current = 0;
        setLastConnectionError(null);
        setConnectionState('connected');
        setIsConnected(true);
      };
      const handleDisconnected = () => {
        setConnectionState('disconnected');
        setIsConnected(false);
        setActiveUsers([]);
        scheduleReconnect('disconnected');
      };
      const handleSuspended = () => {
        setConnectionState('suspended');
        setIsConnected(false);
        setActiveUsers([]);
        scheduleReconnect('suspended');
      };
      const handleFailed = (stateChange: Ably.Types.ConnectionStateChange) => {
        setConnectionState('failed');
        setIsConnected(false);
        setActiveUsers([]);
        setLastConnectionError(stateChange.reason?.message ?? 'Connection failed');
        scheduleReconnect('failed');
      };
      const handleClosed = () => {
        setConnectionState('closed');
        setIsConnected(false);
        setActiveUsers([]);
      };

      connectionHandlersRef.current = {
        connected: handleConnected,
        connecting: handleConnecting,
        disconnected: handleDisconnected,
        suspended: handleSuspended,
        failed: handleFailed,
        closed: handleClosed,
      };

      client.connection.on('connecting', handleConnecting);
      client.connection.on('connected', handleConnected);
      client.connection.on('disconnected', handleDisconnected);
      client.connection.on('suspended', handleSuspended);
      client.connection.on('failed', handleFailed);
      client.connection.on('closed', handleClosed);

      updateConnectionStateFromClient(client);
    },
    [scheduleReconnect]
  );

  const refreshPresenceUsers = async (channel: Ably.Types.RealtimeChannelCallbacks) => {
    try {
      const members = await new Promise<Ably.Types.PresenceMessage[]>((resolve, reject) => {
        channel.presence.get((err, result) => {
          if (err) return reject(err);
          resolve(result || []);
        });
      });

      const users: ActiveUser[] = members
        .map((m) => m.data as ActiveUser)
        .filter((u) => !!u?.email && !!u?.name);

      setActiveUsers(users);
      callbacksRef.current.onPresenceUpdate?.(users);
    } catch (err) {
      console.error('Error getting presence members:', err);
    }
  };

  const connect = useCallback(async () => {
    if (!storeId || !enabled) return;
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    try {
      const client = await getAblyClient();
      clientRef.current = client;
      installConnectionHandlers(client);

      // Ensure we don't duplicate subscriptions when reconnecting.
      teardownChannel();

      const channelName = `shopping-store:${storeId}`;
      channelNameRef.current = channelName;
      const channel = client.channels.get(channelName);
      channelRef.current = channel;

      // Enter presence with current user info so others can see who is viewing
      const userForPresence = presenceUserRef.current;
      if (userForPresence) {
        try {
          channel.presence.enter(userForPresence);
        } catch (err) {
          console.error('Error entering Ably presence:', err);
        }
      }

      channel.subscribe('item_checked', (msg) => {
        const data = msg.data as ShoppingListSyncMessage;
        if (data.foodItemId !== undefined && data.checked !== undefined && data.updatedBy) {
          callbacksRef.current.onItemChecked?.(data.foodItemId, data.checked, data.updatedBy);
        }
      });

      channel.subscribe('list_updated', (msg) => {
        const data = msg.data as ShoppingListSyncMessage;
        if (data.items && data.updatedBy) {
          callbacksRef.current.onListUpdated?.(data.items, data.updatedBy);
        }
      });

      channel.subscribe('item_deleted', (msg) => {
        const data = msg.data as ShoppingListSyncMessage;
        if (data.foodItemId && data.updatedBy) {
          callbacksRef.current.onItemDeleted?.(data.foodItemId, data.updatedBy);
        }
      });

      // Presence: update list on any presence activity, and also do an initial fetch.
      channel.presence.subscribe(() => {
        void refreshPresenceUsers(channel);
      });
      void refreshPresenceUsers(channel);

      // If the client is currently disconnected/closed, ask it to connect.
      // Ably will typically auto-reconnect, but this helps in edge cases.
      if (client.connection.state !== 'connected' && client.connection.state !== 'connecting') {
        try {
          // Some tests/mock clients may not implement connect(); Ably does.
          if (typeof (client as unknown as { connect?: unknown }).connect === 'function') {
            (client as unknown as { connect: () => void }).connect();
          }
        } catch (err) {
          console.error('Error requesting Ably connect():', err);
        }
      }

      updateConnectionStateFromClient(client);
    } catch (error) {
      console.error('Error connecting to Ably:', error);
      setIsConnected(false);
      setConnectionState('failed');
      setLastConnectionError(error instanceof Error ? error.message : 'Connection failed');
      scheduleReconnect('connect_error');
    } finally {
      isConnectingRef.current = false;
    }
  }, [enabled, installConnectionHandlers, scheduleReconnect, storeId, teardownChannel]);
  connectRef.current = connect;

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    teardownChannel();
    setIsConnected(false);
    setConnectionState('disconnected');
    setActiveUsers([]);
  }, [teardownChannel]);

  const reconnect = useCallback(async () => {
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    setLastConnectionError(null);
    await connect();
  }, [connect]);

  useEffect(() => {
    if (storeId && enabled) {
      void connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
      const client = clientRef.current;
      const handlers = connectionHandlersRef.current;
      if (client && handlers.connected) {
        try {
          if (handlers.connecting) {
            client.connection.off?.('connecting', handlers.connecting);
          }
          client.connection.off?.('connected', handlers.connected);
          if (handlers.disconnected) {
            client.connection.off?.('disconnected', handlers.disconnected);
          }
          if (handlers.suspended) {
            client.connection.off?.('suspended', handlers.suspended);
          }
          if (handlers.failed) {
            client.connection.off?.('failed', handlers.failed);
          }
          if (handlers.closed) {
            client.connection.off?.('closed', handlers.closed);
          }
        } catch {
          // Best-effort cleanup; Ably types differ slightly between versions.
        }
      }
      connectionHandlersRef.current = {};
    };
  }, [storeId, enabled, connect, disconnect]);

  return {
    isConnected,
    connectionState,
    lastConnectionError,
    activeUsers,
    reconnect,
    disconnect,
  };
}
