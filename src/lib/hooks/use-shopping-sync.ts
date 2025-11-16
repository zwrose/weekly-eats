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
}

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
    onItemDeleted
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const clientRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.Types.RealtimeChannelCallbacks | null>(null);
  const presenceUserRef = useRef<ActiveUser | null>(presenceUser ?? null);

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef({
    onPresenceUpdate,
    onItemChecked,
    onListUpdated,
    onItemDeleted
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onPresenceUpdate,
      onItemChecked,
      onListUpdated,
      onItemDeleted
    };
  }, [onPresenceUpdate, onItemChecked, onListUpdated, onItemDeleted]);

  // Keep presenceUser in a ref so we don't need it in connect's dependencies
  useEffect(() => {
    presenceUserRef.current = presenceUser ?? null;
  }, [presenceUser]);

  const connect = useCallback(async () => {
    if (!storeId || !enabled) return;

    try {
      const client = getAblyClient();
      clientRef.current = client;

      const channelName = `shopping-store:${storeId}`;
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

      // Presence: use Ably presence to track active users
      channel.presence.subscribe(async () => {
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
      });

      // Enter presence with current user info (handled in consuming component via session)
      // The consumer passes onPresenceUpdate, so we don't need to store user info here.

      client.connection.on('connected', () => {
        setIsConnected(true);
      });

      client.connection.on('disconnected', () => {
        setIsConnected(false);
        setActiveUsers([]);
      });
    } catch (error) {
      console.error('Error connecting to Ably:', error);
      setIsConnected(false);
    }
  }, [storeId, enabled]);

  const disconnect = useCallback(() => {
    const channel = channelRef.current;
    if (channel) {
      try {
        // Leave presence for this channel
        channel.presence.leave();
        channel.unsubscribe();
        channel.presence.unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing from Ably channel:', error);
      }
      channelRef.current = null;
    }

    setIsConnected(false);
    setActiveUsers([]);
  }, []);

  useEffect(() => {
    if (storeId && enabled) {
      void connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [storeId, enabled, connect, disconnect]);

  return {
    isConnected,
    activeUsers,
    reconnect: connect,
    disconnect
  };
}




