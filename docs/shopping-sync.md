# Shopping Sync Feature

## Overview

The Shopping Sync feature provides real-time synchronization of shopping lists between multiple users who have access to the same store. When users are viewing or editing a shared shopping list, changes are instantly propagated to all connected users.

## Features

### 1. **Real-Time Presence Tracking**
- Shows which users are currently viewing the same shopping list
- Displays active users as badges in the dialog header
- Shows a "Live" indicator when connected to the sync stream

### 2. **Real-Time Updates**
All changes are synchronized across users:
- ✅ **Check/Uncheck items** - When one user checks off an item in shopping mode, it updates for all users
- ✅ **Add items** - New items appear instantly for all users
- ✅ **Delete items** - Removed items disappear for all users
- ✅ **Quantity changes** - Updated quantities sync in real-time
- ✅ **Unit changes** - Changed units sync immediately

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

#### 1. Broadcast Utilities
**File**: `src/lib/shopping-sync-broadcast.ts`

**Responsibilities**:
- Manages in-memory connections for all active SSE streams
- Provides broadcasting functions for real-time updates
- Handles connection lifecycle (add/remove)

**Key Functions**:
```typescript
// Broadcast a message to all users viewing a store
broadcastToStore(storeId, message, excludeUserId?)

// Get list of active users for a store
getActiveUsers(storeId)

// Broadcast presence updates
broadcastPresence(storeId)

// Add/remove connections
addConnection(storeId, userId, controller, userEmail, userName)
removeConnection(storeId, userId)
```

#### 2. SSE Stream Endpoint
**File**: `src/app/api/shopping-lists/sync/stream/route.ts`

**Responsibilities**:
- Creates and manages SSE connections for clients
- Validates user access to stores
- Sends initial presence on connection
- Implements automatic keepalive pings every 30 seconds
- Handles graceful disconnect and cleanup

**Endpoint**: `GET /api/shopping-lists/sync/stream?storeId={storeId}`

#### 3. Item Toggle Endpoint
**File**: `src/app/api/shopping-lists/[storeId]/items/[foodItemId]/toggle/route.ts`

**Purpose**: Dedicated endpoint for toggling individual item checked status
- Prevents race conditions when multiple users check items simultaneously
- Uses atomic database operations
- Broadcasts changes via SSE
- Returns 404 if item was deleted by another user

**Endpoint**: `PATCH /api/shopping-lists/{storeId}/items/{foodItemId}/toggle`

#### 4. Shopping List Update Endpoint (Enhanced)
**File**: `src/app/api/shopping-lists/[storeId]/route.ts`

**Enhancement**: Now broadcasts `list_updated` events when the full list is updated
- Add/delete items
- Quantity changes
- Unit changes

#### 5. Shopping Sync Hook
**File**: `src/lib/hooks/use-shopping-sync.ts`

**Purpose**: React hook that manages the SSE connection and handles incoming events

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
- Automatic connection when dialog opens
- Automatic disconnect when dialog closes
- Reconnection with exponential backoff (up to 5 attempts)
- Connection state tracking

### Message Types

#### Presence Message
```typescript
{
  type: 'presence',
  activeUsers: [
    { email: 'user@example.com', name: 'User Name' }
  ],
  timestamp: '2025-10-13T12:00:00.000Z'
}
```

#### Item Checked Message
```typescript
{
  type: 'item_checked',
  foodItemId: 'food-123',
  checked: true,
  updatedBy: 'user@example.com',
  timestamp: '2025-10-13T12:00:00.000Z'
}
```

#### List Updated Message
```typescript
{
  type: 'list_updated',
  items: [...], // Full shopping list items array
  updatedBy: 'user@example.com',
  timestamp: '2025-10-13T12:00:00.000Z'
}
```

#### Item Deleted Message
```typescript
{
  type: 'item_deleted',
  foodItemId: 'food-123',
  updatedBy: 'user@example.com',
  timestamp: '2025-10-13T12:00:00.000Z'
}
```

## UI Changes

### Shopping List Dialog Header
- Shows list of active users as badges (e.g., "John Doe", "Jane Smith")
- Shows "Live" indicator with green dot when connected
- Compact display that wraps on mobile

### Shopping Mode
- Items checked by any user instantly update for all users
- Checked items automatically move to bottom for everyone
- Optimistic updates with error rollback

### Error Handling
- "This item was already removed from the list" - shown when trying to modify deleted items
- Auto-refresh list on conflict
- Network errors trigger automatic reconnection

## Access Control

Users can access the sync stream if:
1. They are the store owner (`store.userId === session.user.id`)
2. OR they have an accepted invitation to the store

The endpoint validates access on every connection.

## Performance Considerations

### Optimistic Updates
- UI updates immediately for the user taking action
- Reverts if the server returns an error
- Prevents UI lag during sync

### Efficient Broadcasting
- Only sends updates to users actively viewing the store
- Excludes the sender from broadcasts (they already have the latest state)
- Cleans up connections when users disconnect

### Reconnection Strategy
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
- Maximum 5 reconnection attempts
- Prevents server overload during network issues

## Database Schema

### Store Document
```typescript
{
  _id: ObjectId,
  userId: string,           // Owner ID
  name: string,
  emoji: string,
  invitations: [
    {
      userId: string,
      userEmail: string,
      userName: string,
      status: 'pending' | 'accepted' | 'rejected',
      invitedBy: string,
      invitedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Shopping List Document
```typescript
{
  _id: ObjectId,
  storeId: string,
  userId: string,
  items: [
    {
      foodItemId: string,
      quantity: number,
      unit: string,
      checked: boolean,      // Added for shopping mode
      name: string           // Populated from foodItems
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

## Testing

### Test Coverage
- ✅ SSE stream authentication and authorization
- ✅ Broadcasting functionality
- ✅ Message format contracts
- ✅ Item toggle endpoint (10 tests)
- ✅ Access control for shared users
- ✅ Conflict detection (404 for deleted items)

**Files**:
- `src/app/api/shopping-lists/sync/stream/__tests__/route.test.ts` (7 tests)
- `src/app/api/shopping-lists/[storeId]/items/[foodItemId]/toggle/__tests__/route.test.ts` (10 tests)

### Running Tests
```bash
# Run all shopping sync tests
npm test -- src/app/api/shopping-lists

# Run specific test files
npm test -- "src/app/api/shopping-lists/sync/stream/__tests__/route.test.ts"
```

## Usage Example

### User A Actions
1. Opens "Costco" shopping list
2. Enters Shopping Mode
3. Checks off "Milk"

### User B Experience (Real-time)
1. Sees "User A" badge appear in header
2. Sees "Milk" checkbox automatically check itself
3. Sees "Milk" move to bottom of list
4. Sees strikethrough applied to "Milk"

## Security

- All operations validate user access to the store
- SSE connections require authentication
- Broadcasts only go to users with accepted invitations
- Store owners can remove user access at any time

## Future Enhancements

Potential improvements:
- Show which user checked off each item
- Undo functionality for accidental deletions
- Conflict resolution UI for simultaneous edits
- Mobile push notifications when list is updated
- Offline mode with sync when reconnected
- Show typing indicators for quantity/unit changes

## Known Limitations

1. **Connection limit**: Browser EventSource has a connection limit (typically 6 per domain)
2. **Reconnection**: Limited to 5 attempts; after that, user must refresh
3. **Network**: Requires stable internet connection for real-time sync
4. **Scale**: In-memory connection tracking (would need Redis for multi-server deployments)

## Migration Notes

No database migration required - the `checked` field is optional and defaults to `false` for existing items.

