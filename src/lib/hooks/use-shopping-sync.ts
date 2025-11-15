import { useEffect, useRef, useState, useCallback } from 'react';

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
  onPresenceUpdate?: (users: ActiveUser[]) => void;
  onItemChecked?: (foodItemId: string, checked: boolean, updatedBy: string) => void;
  onListUpdated?: (items: unknown[], updatedBy: string) => void;
  onItemDeleted?: (foodItemId: string, updatedBy: string) => void;
}

/**
 * Hook to manage SSE connection for shopping list real-time sync
 */
export function useShoppingSync(options: UseShoppingSyncOptions) {
  const {
    storeId,
    enabled = true,
    onPresenceUpdate,
    onItemChecked,
    onListUpdated,
    onItemDeleted
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

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

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: ShoppingListSyncMessage = JSON.parse(event.data);

      switch (data.type) {
        case 'presence':
          if (data.activeUsers) {
            setActiveUsers(data.activeUsers);
            callbacksRef.current.onPresenceUpdate?.(data.activeUsers);
          }
          break;

        case 'item_checked':
          if (data.foodItemId !== undefined && data.checked !== undefined && data.updatedBy) {
            callbacksRef.current.onItemChecked?.(data.foodItemId, data.checked, data.updatedBy);
          }
          break;

        case 'list_updated':
          if (data.items && data.updatedBy) {
            callbacksRef.current.onListUpdated?.(data.items, data.updatedBy);
          }
          break;

        case 'item_deleted':
          if (data.foodItemId && data.updatedBy) {
            callbacksRef.current.onItemDeleted?.(data.foodItemId, data.updatedBy);
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing SSE message:', error);
    }
  }, []);

  const connect = useCallback(() => {
    if (!storeId || !enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(
        `/api/shopping-lists/sync/stream?storeId=${storeId}`
      );

      eventSource.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = handleMessage;

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('Error creating EventSource:', error);
      setIsConnected(false);
    }
  }, [storeId, enabled, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    setActiveUsers([]);
  }, []);

  useEffect(() => {
    if (storeId && enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
    // Only depend on storeId and enabled - connect/disconnect are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, enabled]);

  return {
    isConnected,
    activeUsers,
    reconnect: connect,
    disconnect
  };
}




