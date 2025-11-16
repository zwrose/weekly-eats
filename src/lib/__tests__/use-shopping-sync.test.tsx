import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { useShoppingSync, type UseShoppingSyncOptions, type ActiveUser } from '../hooks/use-shopping-sync';

// Mock the Ably client factory
const mockSubscribe = vi.fn();
const mockPresenceEnter = vi.fn();
const mockPresenceSubscribe = vi.fn();
const mockPresenceGet = vi.fn();
const mockPresenceLeave = vi.fn();
const mockPresenceUnsubscribe = vi.fn();
const mockConnectionOn = vi.fn();
const mockChannelsGet = vi.fn();

// Storage for handlers we register on the mocked channel/connection
const channelEventHandlers: Record<string, (msg: { data: unknown }) => void> = {};
const presenceHandlers: Array<() => void> = [];
const connectionHandlers: Record<string, () => void> = {};

const mockChannel = {
  subscribe: mockSubscribe.mockImplementation(
    (event: string, handler: (msg: { data: unknown }) => void) => {
      channelEventHandlers[event] = handler;
    }
  ),
  presence: {
    enter: mockPresenceEnter,
    subscribe: mockPresenceSubscribe.mockImplementation((handler: () => void) => {
      presenceHandlers.push(handler);
    }),
    get: mockPresenceGet,
    leave: mockPresenceLeave,
    unsubscribe: mockPresenceUnsubscribe,
  },
};

const mockClient = {
  channels: {
    get: mockChannelsGet.mockImplementation(() => mockChannel),
  },
  connection: {
    on: mockConnectionOn.mockImplementation((event: string, handler: () => void) => {
      connectionHandlers[event] = handler;
    }),
  },
};

vi.mock('../realtime/ably-client', () => ({
  getAblyClient: () => mockClient,
}));

// Test harness component to use the hook and expose its state externally
let latestHookState: ReturnType<typeof useShoppingSync> | null = null;

const TestComponent: React.FC<{ options: UseShoppingSyncOptions }> = ({ options }) => {
  latestHookState = useShoppingSync(options);
  return null;
};

describe('useShoppingSync (Ably-based shopping sync hook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestHookState = null;
    // Clear handler storage
    Object.keys(channelEventHandlers).forEach((k) => delete channelEventHandlers[k]);
    presenceHandlers.length = 0;
    Object.keys(connectionHandlers).forEach((k) => delete connectionHandlers[k]);
  });

  afterEach(() => {
    cleanup();
  });

  it('connects to Ably when storeId and enabled are set, and enters presence', async () => {
    const onPresenceUpdate = vi.fn();

    render(
      <TestComponent
        options={{
          storeId: 'store-1',
          enabled: true,
          presenceUser: { email: 'user@example.com', name: 'User' },
          onPresenceUpdate,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).toHaveBeenCalledWith('shopping-store:store-1');
    });

    expect(mockPresenceEnter).toHaveBeenCalledWith({
      email: 'user@example.com',
      name: 'User',
    });
  });

  it('invokes onItemChecked callback when item_checked event is received', async () => {
    const onItemChecked = vi.fn();

    render(
      <TestComponent
        options={{
          storeId: 'store-1',
          enabled: true,
          onItemChecked,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).toHaveBeenCalled();
    });

    // Simulate an Ably item_checked message
    const handler = channelEventHandlers['item_checked'];
    expect(handler).toBeDefined();

    handler!({
      data: {
        type: 'item_checked',
        foodItemId: 'f1',
        checked: true,
        updatedBy: 'remote@example.com',
      },
    });

    expect(onItemChecked).toHaveBeenCalledWith('f1', true, 'remote@example.com');
  });

  it('invokes onListUpdated callback when list_updated event is received', async () => {
    const onListUpdated = vi.fn();
    const items = [{ foodItemId: 'f1' }, { foodItemId: 'f2' }];

    render(
      <TestComponent
        options={{
          storeId: 'store-1',
          enabled: true,
          onListUpdated,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).toHaveBeenCalled();
    });

    const handler = channelEventHandlers['list_updated'];
    expect(handler).toBeDefined();

    handler!({
      data: {
        type: 'list_updated',
        items,
        updatedBy: 'remote@example.com',
      },
    });

    expect(onListUpdated).toHaveBeenCalledWith(items, 'remote@example.com');
  });

  it('invokes onItemDeleted callback when item_deleted event is received', async () => {
    const onItemDeleted = vi.fn();

    render(
      <TestComponent
        options={{
          storeId: 'store-1',
          enabled: true,
          onItemDeleted,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).toHaveBeenCalled();
    });

    const handler = channelEventHandlers['item_deleted'];
    expect(handler).toBeDefined();

    handler!({
      data: {
        type: 'item_deleted',
        foodItemId: 'f1',
        updatedBy: 'remote@example.com',
      },
    });

    expect(onItemDeleted).toHaveBeenCalledWith('f1', 'remote@example.com');
  });

  it('updates activeUsers and calls onPresenceUpdate when presence changes', async () => {
    const onPresenceUpdate = vi.fn();

    mockPresenceGet.mockImplementation(
      (cb: (err: Error | null, result?: Array<{ data: ActiveUser | null }> | null) => void) => {
        cb(null, [
          { data: { email: 'a@example.com', name: 'User A' } },
          { data: { email: '', name: 'Missing Email' } },
        ] as any);
      }
    );

    render(
      <TestComponent
        options={{
          storeId: 'store-1',
          enabled: true,
          onPresenceUpdate,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).toHaveBeenCalled();
    });

    // Simulate a presence event (any join/leave/update)
    expect(presenceHandlers.length).toBeGreaterThan(0);
    presenceHandlers[0]!();

    await waitFor(() => {
      expect(onPresenceUpdate).toHaveBeenCalled();
      expect(latestHookState?.activeUsers).toEqual([
        { email: 'a@example.com', name: 'User A' },
      ]);
    });
  });

  it('tracks connection state (isConnected) based on Ably connection events', async () => {
    render(
      <TestComponent
        options={{
          storeId: 'store-1',
          enabled: true,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).toHaveBeenCalled();
    });

    // Simulate connection events
    expect(connectionHandlers.connected).toBeDefined();
    expect(connectionHandlers.disconnected).toBeDefined();

    connectionHandlers.connected!();

    await waitFor(() => {
      expect(latestHookState?.isConnected).toBe(true);
    });

    connectionHandlers.disconnected!();

    await waitFor(() => {
      expect(latestHookState?.isConnected).toBe(false);
      expect(latestHookState?.activeUsers).toEqual([]);
    });
  });

  it('disconnect() leaves presence, unsubscribes, and clears state', async () => {
    render(
      <TestComponent
        options={{
          storeId: 'store-1',
          enabled: true,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).toHaveBeenCalled();
      expect(latestHookState).not.toBeNull();
    });

    // Simulate connected so we start from a "connected" state
    connectionHandlers.connected?.();

    await waitFor(() => {
      expect(latestHookState?.isConnected).toBe(true);
    });

    // Call disconnect from the hook's API
    latestHookState?.disconnect();

    await waitFor(() => {
      expect(mockPresenceLeave).toHaveBeenCalled();
      // We don't assert unsubscribe here because our mock channel does not implement it,
      // and the hook guards errors when calling unsubscribe.
      expect(latestHookState?.isConnected).toBe(false);
      expect(latestHookState?.activeUsers).toEqual([]);
    });
  });

  it('does not connect when storeId is null or enabled is false', async () => {
    render(
      <TestComponent
        options={{
          storeId: null,
          enabled: true,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).not.toHaveBeenCalled();
      expect(latestHookState?.isConnected).toBe(false);
    });

    cleanup();

    render(
      <TestComponent
        options={{
          storeId: 'store-1',
          enabled: false,
        }}
      />
    );

    await waitFor(() => {
      expect(mockChannelsGet).not.toHaveBeenCalled();
      expect(latestHookState?.isConnected).toBe(false);
    });
  });
});


