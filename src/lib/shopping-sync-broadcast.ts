/**
 * Shopping List Sync Broadcasting Utilities
 * 
 * Manages real-time synchronization of shopping lists via Server-Sent Events (SSE)
 */

// In-memory store for active connections per store
// Map<storeId, Map<userId, { controller: ReadableStreamDefaultController, userEmail: string, userName: string }>>
const activeConnections = new Map<string, Map<string, {
  controller: ReadableStreamDefaultController;
  userEmail: string;
  userName: string;
}>>();

/**
 * Get list of active users for a store
 */
export function getActiveUsers(storeId: string) {
  const connections = activeConnections.get(storeId);
  if (!connections) return [];

  return Array.from(connections.values()).map(conn => ({
    email: conn.userEmail,
    name: conn.userName
  }));
}

/**
 * Broadcast a message to all connected users for a store (except sender)
 */
export function broadcastToStore(storeId: string, message: unknown, excludeUserId?: string) {
  const connections = activeConnections.get(storeId);
  if (!connections) return;

  const encoder = new TextEncoder();
  const data = JSON.stringify(message);

  connections.forEach((connection, userId) => {
    if (userId !== excludeUserId) {
      try {
        connection.controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      } catch (error) {
        console.error(`Error broadcasting to user ${userId}:`, error);
        // Remove dead connection
        connections.delete(userId);
      }
    }
  });

  // Clean up empty store connections
  if (connections.size === 0) {
    activeConnections.delete(storeId);
  }
}

/**
 * Broadcast presence update to all users in a store
 */
export function broadcastPresence(storeId: string) {
  const activeUsers = getActiveUsers(storeId);
  broadcastToStore(storeId, {
    type: 'presence',
    activeUsers,
    timestamp: new Date().toISOString()
  });
}

/**
 * Add a user connection to a store
 */
export function addConnection(
  storeId: string, 
  userId: string, 
  controller: ReadableStreamDefaultController,
  userEmail: string,
  userName: string
) {
  if (!activeConnections.has(storeId)) {
    activeConnections.set(storeId, new Map());
  }

  const storeConnections = activeConnections.get(storeId)!;
  storeConnections.set(userId, { controller, userEmail, userName });
}

/**
 * Remove a user connection from a store
 */
export function removeConnection(storeId: string, userId: string) {
  const connections = activeConnections.get(storeId);
  if (!connections) return;

  connections.delete(userId);

  // Clean up empty store connections
  if (connections.size === 0) {
    activeConnections.delete(storeId);
  }
}

/**
 * Get active connections map (for testing)
 */
export function getActiveConnectionsMap() {
  return activeConnections;
}

/**
 * Clear all connections (for testing)
 */
export function clearAllConnections() {
  activeConnections.clear();
}

