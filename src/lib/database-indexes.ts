import { getMongoClient } from './mongodb';

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
    await mealPlansCollection.createIndex(
      { templateId: 1 },
      { name: 'mealPlans_templateId' }
    );

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
    await foodItemsCollection.createIndex(
      { isGlobal: 1 },
      { name: 'foodItems_isGlobal' }
    );
    await foodItemsCollection.createIndex(
      { name: 1 },
      { name: 'foodItems_name' }
    );

    // Recipes Collection
    const recipesCollection = db.collection('recipes');
    await recipesCollection.createIndex(
      { createdBy: 1, isGlobal: 1 },
      { name: 'recipes_createdBy_isGlobal' }
    );
    await recipesCollection.createIndex(
      { isGlobal: 1 },
      { name: 'recipes_isGlobal' }
    );
    await recipesCollection.createIndex(
      { title: 1 },
      { name: 'recipes_title' }
    );

    // Recipe User Data Collection
    const recipeUserDataCollection = db.collection('recipeUserData');
    await recipeUserDataCollection.createIndex(
      { userId: 1, recipeId: 1 },
      { name: 'recipeUserData_userId_recipeId', unique: true }
    );

    // Pantry Collection
    const pantryCollection = db.collection('pantry');
    await pantryCollection.createIndex(
      { userId: 1 },
      { name: 'pantry_userId' }
    );
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

    // Users Collection (if you have one)
    const usersCollection = db.collection('users');
    await usersCollection.createIndex(
      { email: 1 },
      { name: 'users_email', unique: true }
    );
    await usersCollection.createIndex(
      { isApproved: 1 },
      { name: 'users_isApproved' }
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
      'shoppingLists'
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