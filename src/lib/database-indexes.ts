import { getMongoClient } from './mongodb';
import { SEEDABLE_COLLECTIONS } from './seedable-collections.js';

// Re-export the single source of truth. The .js file is plain ESM (so the
// postinstall-invoked setup-worktree.js can import it without TS tooling); its
// JSDoc `@type {const}` cast gives it a readonly literal-tuple type, so the
// derived SeedableCollection union below stays exact with no cast here.
export { SEEDABLE_COLLECTIONS };

export type SeedableCollection = (typeof SEEDABLE_COLLECTIONS)[number];

/**
 * Database indexes for optimal query performance
 * These should be created once during application setup
 */

export const createDatabaseIndexes = async () => {
  const client = await getMongoClient();
  const db = client.db();

  try {
    console.log('Creating database indexes...');

    // Meal Plans Collection
    const mealPlansCollection = db.collection('mealPlans');
    await mealPlansCollection.createIndex(
      { userId: 1, startDate: -1 },
      { name: 'mealPlans_userId_startDate' }
    );
    await mealPlansCollection.createIndex(
      { userId: 1, createdAt: -1 },
      { name: 'mealPlans_userId_createdAt' }
    );
    await mealPlansCollection.createIndex({ templateId: 1 }, { name: 'mealPlans_templateId' });

    // Meal Plan Templates Collection
    const templatesCollection = db.collection('mealPlanTemplates');
    await templatesCollection.createIndex(
      { userId: 1 },
      { name: 'mealPlanTemplates_userId', unique: true }
    );

    // Food Items Collection
    const foodItemsCollection = db.collection('foodItems');
    await foodItemsCollection.createIndex(
      { createdBy: 1, isGlobal: 1 },
      { name: 'foodItems_createdBy_isGlobal' }
    );
    await foodItemsCollection.createIndex({ isGlobal: 1 }, { name: 'foodItems_isGlobal' });
    await foodItemsCollection.createIndex({ name: 1 }, { name: 'foodItems_name' });

    // Recipes Collection
    const recipesCollection = db.collection('recipes');
    await recipesCollection.createIndex(
      { createdBy: 1, isGlobal: 1 },
      { name: 'recipes_createdBy_isGlobal' }
    );
    await recipesCollection.createIndex({ isGlobal: 1 }, { name: 'recipes_isGlobal' });
    await recipesCollection.createIndex({ title: 1 }, { name: 'recipes_title' });

    // Recipes: support pagination with updatedAt sort
    await recipesCollection.createIndex(
      { isGlobal: 1, createdBy: 1, updatedAt: -1 },
      { name: 'recipes_unified_pagination' }
    );

    // Recipe User Data Collection
    const recipeUserDataCollection = db.collection('recipeUserData');
    await recipeUserDataCollection.createIndex(
      { userId: 1, recipeId: 1 },
      { name: 'recipeUserData_userId_recipeId', unique: true }
    );

    // Pantry Collection
    const pantryCollection = db.collection('pantry');
    await pantryCollection.createIndex({ userId: 1 }, { name: 'pantry_userId' });
    await pantryCollection.createIndex(
      { userId: 1, foodItemId: 1 },
      { name: 'pantry_userId_foodItemId', unique: true }
    );

    // Shopping Lists Collection
    const shoppingListsCollection = db.collection('shoppingLists');
    await shoppingListsCollection.createIndex(
      { storeId: 1 },
      { name: 'shoppingLists_storeId', unique: true }
    );

    // Store Item Positions Collection
    const storeItemPositionsCollection = db.collection('storeItemPositions');
    await storeItemPositionsCollection.createIndex(
      { storeId: 1, foodItemId: 1 },
      { name: 'storeItemPositions_storeId_foodItemId', unique: true }
    );
    await storeItemPositionsCollection.createIndex(
      { storeId: 1, position: 1 },
      { name: 'storeItemPositions_storeId_position' }
    );

    // Purchase History Collection
    const purchaseHistoryCollection = db.collection('purchaseHistory');
    await purchaseHistoryCollection.createIndex(
      { storeId: 1, foodItemId: 1 },
      { name: 'purchaseHistory_storeId_foodItemId', unique: true }
    );
    await purchaseHistoryCollection.createIndex(
      { storeId: 1, lastPurchasedAt: -1 },
      { name: 'purchaseHistory_storeId_lastPurchasedAt' }
    );

    // Users Collection (if you have one)
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { name: 'users_email', unique: true });
    await usersCollection.createIndex({ isApproved: 1 }, { name: 'users_isApproved' });

    // Manual-testing seed tags — speed up clean() filters
    for (const colName of SEEDABLE_COLLECTIONS) {
      await db
        .collection(colName)
        .createIndex(
          { _seedManifestId: 1, _seedScenarioId: 1 },
          { name: `${colName}_seedTag`, sparse: true }
        );
    }

    // manualTestState collection
    await db
      .collection('manualTestState')
      .createIndex(
        { manifestId: 1, scenarioId: 1 },
        { name: 'manualTestState_manifest_scenario', unique: true }
      );

    // manualTestLocks collection
    await db
      .collection('manualTestLocks')
      .createIndex({ manifestId: 1 }, { name: 'manualTestLocks_manifestId', unique: true });
    await db
      .collection('manualTestLocks')
      .createIndex(
        { expireAt: 1 },
        { name: 'manualTestLocks_expireAt_ttl', expireAfterSeconds: 0 }
      );

    // --- MCP OAuth Authorization Server collections (Phase 2, spec §9) ---

    // mcpClients — registered DCR clients; unique clientId; TTL reaps clients
    // unused for 90 days (I6). touchClient refreshes lastUsedAt on every use, so
    // active clients are never reaped. New registrations start with lastUsedAt=now.
    const mcpClients = db.collection('mcpClients');
    await mcpClients.createIndex({ clientId: 1 }, { name: 'mcpClients_clientId', unique: true });
    await mcpClients.createIndex(
      { lastUsedAt: 1 },
      { name: 'mcpClients_lastUsedAt_ttl', expireAfterSeconds: 60 * 60 * 24 * 90 }
    );

    // mcpAuthCodes — single-use PKCE codes; lookup by hash; TTL on expiry.
    const mcpAuthCodes = db.collection('mcpAuthCodes');
    await mcpAuthCodes.createIndex(
      { hashedCode: 1 },
      { name: 'mcpAuthCodes_hashedCode', unique: true }
    );
    await mcpAuthCodes.createIndex(
      { expiresAt: 1 },
      { name: 'mcpAuthCodes_expiry_ttl', expireAfterSeconds: 0 }
    );

    // mcpTokens — access + refresh; lookup by hash; chain ops by grantId; TTL on expiry.
    const mcpTokens = db.collection('mcpTokens');
    await mcpTokens.createIndex(
      { hashedToken: 1 },
      { name: 'mcpTokens_hashedToken', unique: true }
    );
    await mcpTokens.createIndex({ grantId: 1 }, { name: 'mcpTokens_grantId' });
    await mcpTokens.createIndex(
      { expiresAt: 1 },
      { name: 'mcpTokens_expiry_ttl', expireAfterSeconds: 0 }
    );

    // mcpAuthStates — in-flight /authorize nonces; lookup by hash; TTL on expiry.
    const mcpAuthStates = db.collection('mcpAuthStates');
    await mcpAuthStates.createIndex(
      { hashedState: 1 },
      { name: 'mcpAuthStates_hashedState', unique: true }
    );
    await mcpAuthStates.createIndex(
      { expiresAt: 1 },
      { name: 'mcpAuthStates_expiry_ttl', expireAfterSeconds: 0 }
    );

    // mcpConsents — one row per (userId, clientId); exact-match consent skip (CS1).
    const mcpConsents = db.collection('mcpConsents');
    await mcpConsents.createIndex(
      { userId: 1, clientId: 1 },
      { name: 'mcpConsents_userId_clientId', unique: true }
    );

    // mcpRateLimits — DCR per-IP throttle (I6); lookup by key; TTL on expiry.
    const mcpRateLimits = db.collection('mcpRateLimits');
    await mcpRateLimits.createIndex({ key: 1 }, { name: 'mcpRateLimits_key', unique: true });
    await mcpRateLimits.createIndex(
      { expiresAt: 1 },
      { name: 'mcpRateLimits_expiry_ttl', expireAfterSeconds: 0 }
    );

    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating database indexes:', error);
    throw error;
  }
};

/**
 * Drop all indexes (useful for development/testing)
 */
export const dropAllIndexes = async () => {
  const client = await getMongoClient();
  const db = client.db();

  try {
    console.log('Dropping all database indexes...');

    const collections = [
      'mealPlans',
      'mealPlanTemplates',
      'foodItems',
      'recipes',
      'recipeUserData',
      'pantry',
      'users',
      'storeItemPositions',
      'shoppingLists',
      'purchaseHistory',
      'mcpClients',
      'mcpAuthCodes',
      'mcpTokens',
      'mcpAuthStates',
      'mcpConsents',
      'mcpRateLimits',
      'manualTestState',
      'manualTestLocks',
    ];

    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      await collection.dropIndexes();
      console.log(`Dropped indexes for ${collectionName}`);
    }

    console.log('All database indexes dropped successfully');
  } catch (error) {
    console.error('Error dropping database indexes:', error);
    throw error;
  }
};
