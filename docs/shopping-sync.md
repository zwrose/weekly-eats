# Shopping Sync Feature (Ably)

## Overview

The Shopping Sync feature provides real-time synchronization of shopping lists between multiple users who have access to the same store. When users are viewing or editing a shared shopping list, changes are instantly propagated to all connected users via **Ably Pub/Sub**.

## Features

### 1. **Real-Time Presence Tracking**
- **Shows** which users are currently viewing the same shopping list
- **Displays** active users as badges in the dialog header
- **Shows** a "Live" indicator when connected to Ably

### 2. **Real-Time Updates**
All changes are synchronized across users:
- **Check/Uncheck items** – When one user checks off an item in shopping mode, it updates for all users
- **Add items** – New items appear instantly for all users
- **Delete items** – Removed items disappear for all users
- **Quantity changes** – Updated quantities sync in real-time
- **Unit changes** – Changed units sync immediately

### 3. **Conflict Resolution**
- **Check/Uncheck conflicts**: Last write wins
- **Quantity/Unit conflicts**: Last write wins
- **Delete conflicts**: User attempting to modify a deleted item sees an error message

### 4. **Shopping Mode Sync**
When multiple users are in Shopping Mode simultaneously:
- Items checked by one user move to the bottom for all users
- Checked items show strikethrough and reduced opacity for everyone
- List automatically re-sorts as items are checked off

## Architecture

### Components

#### 1. Ably Server Helper
**File**: `src/lib/realtime/ably-server.ts`

**Responsibilities**:
- Creates a singleton Ably REST client using `ABLY_API_KEY`
- Publishes shopping events to Ably channels

**Key Function**:
```typescript
publishShoppingEvent(
  storeId: string,
  name: 'item_checked' | 'list_updated' | 'item_deleted',
  data: unknown
)
```

#### 2. Ably Token Endpoint
**File**: `src/app/api/ably/token/route.ts`

**Responsibilities**:
- Issues Ably token requests for the browser client using the server-side API key
- Used as `authUrl` by the Ably Realtime client on the frontend

**Endpoint**: `GET /api/ably/token`

#### 3. Item Toggle Endpoint
**File**: `src/app/api/shopping-lists/[storeId]/items/[foodItemId]/toggle/route.ts`

**Purpose**: Dedicated endpoint for toggling individual item checked status
- Prevents race conditions when multiple users check items simultaneously
- Uses atomic database operations
- Broadcasts `item_checked` events via Ably
- Returns 404 if the item was deleted by another user

**Endpoint**: `PATCH /api/shopping-lists/{storeId}/items/{foodItemId}/toggle`

#### 4. Shopping List Update Endpoint (Enhanced)
**File**: `src/app/api/shopping-lists/[storeId]/route.ts`

**Enhancement**: Publishes Ably events when the full list is updated
- Publishes `item_deleted` events for items removed between writes
- Publishes a `list_updated` event with the full items array

#### 5. Shopping Sync Hook
**File**: `src/lib/hooks/use-shopping-sync.ts`

**Purpose**: React hook that manages the Ably realtime connection and handles incoming events

**Usage**:
```typescript
const shoppingSync = useShoppingSync({
  storeId: selectedStore?._id || null,
  enabled: viewListDialog.open,
  onPresenceUpdate: (users) => { /* ... */ },
  onItemChecked: (foodItemId, checked, updatedBy) => { /* ... */ },
  onListUpdated: (items, updatedBy) => { /* ... */ },
  onItemDeleted: (foodItemId, updatedBy) => { /* ... */ }
});

// Access connection state
const { isConnected, activeUsers, reconnect, disconnect } = shoppingSync;
```

**Features**:
- Ably channel per store: `shopping-store:{storeId}`
- Automatic subscribe/unsubscribe based on `storeId` and dialog open state
- Uses Ably **presence** to track and broadcast active users
- Connection state tracking (`isConnected`)

### Ably Channels & Message Types

#### Channel Naming
- **Channel**: `shopping-store:{storeId}`

#### `item_checked` Event
**Name**: `item_checked`
```typescript
{
  foodItemId: 'food-123',
  checked: true,
  updatedBy: 'user@example.com',
  timestamp: '2025-10-13T12:00:00.000Z'
}
```

#### `list_updated` Event
**Name**: `list_updated`
```typescript
{
  items: [...], // Full shopping list items array (with names/units)
  updatedBy: 'user@example.com',
  timestamp: '2025-10-13T12:00:00.000Z'
}
```

#### `item_deleted` Event
**Name**: `item_deleted`
```typescript
{
  foodItemId: 'food-123',
  updatedBy: 'user@example.com',
  timestamp: '2025-10-13T12:00:00.000Z'
}
```

#### Presence Data
Presence members carry:
```typescript
{
  email: 'user@example.com',
  name: 'User Name'
}
```

> Note: Presence enter/leave is handled via Ably presence APIs in the hook; the consuming component just receives `ActiveUser[]`.

## UI Behavior

### Shopping List Dialog Header
- Shows list of active users as badges (e.g., "John Doe", "Jane Smith")
- Shows "Live" indicator with green dot when connected
- Compact display that wraps on mobile

### Shopping Mode
- Items checked by any user instantly update for all users
- Checked items automatically move to bottom for everyone
- Optimistic updates with error rollback
- Single toggle per click (row or checkbox), avoiding double-toggles

### Error Handling
- "This item was already removed from the list" when trying to modify deleted items
- Auto-refresh logic in toggle error paths to reconcile conflicts
- Ably connection errors are logged; UI falls back gracefully

## Access Control

Users can participate in realtime sync if:
1. They are the store owner (`store.userId === session.user.id`), or
2. They have an accepted invitation to the store

Access is validated in the underlying API routes (toggle/update) before publishing events.

## Performance & Deployment Notes

- Ably holds the WebSocket connections; Next.js runs on Vercel as usual.
- Publishing to Ably happens from server routes via the REST API (compatible with Vercel functions).
- **Recommended setup**:
  - One Ably app for **production**
  - One Ably app for **non-prod** (local + preview)
- Channel traffic is isolated per Ably app (no cross-env bleed).

## Migration Notes

- The old SSE + in-memory broadcast implementation has been removed.
- No database migration is required – the `checked` field remains optional and defaults to `false` for existing items.


