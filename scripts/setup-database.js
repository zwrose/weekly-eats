#!/usr/bin/env node

/**
 * Database setup script
 * Run this script to initialize database indexes and perform setup tasks
 * 
 * Usage:
 *   node scripts/setup-database.js
 *   npm run setup-db
 */

import { MongoClient } from 'mongodb';

// MongoDB connection string - should match your .env.local
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/weekly-eats';

async function createDatabaseIndexes() {
  const client = new MongoClient(MONGODB_URI);
  let connected = false;
  
  try {
    await client.connect();
    connected = true;
    const db = client.db();

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

    // Users Collection
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
    return true;
  } catch (error) {
    // Check if it's a connection error
    const isConnectionError = error.code === 'ECONNREFUSED' || 
                             error.message?.includes('ECONNREFUSED') ||
                             error.cause?.code === 'ECONNREFUSED';
    
    if (isConnectionError) {
      console.warn('⚠️  MongoDB is not running or not accessible.');
      console.warn('   The database indexes will be created when MongoDB is available.');
      console.warn('   To install MongoDB, run: ./scripts/setup-ubuntu.sh');
      console.warn('   Or see docs/SETUP.md for manual installation instructions.');
      // Exit gracefully so dev server can still start
      return false;
    }
    
    console.error('Error creating database indexes:', error);
    throw error;
  } finally {
    if (connected) {
      await client.close();
    }
  }
}

async function main() {
  try {
    // Skip DB setup in CI/test environments or when explicitly disabled
    const shouldSkip = process.env.CI === 'true' || process.env.NODE_ENV === 'test' || process.env.SKIP_DB_SETUP === 'true';
    if (shouldSkip) {
      console.log('Skipping database setup (CI/test/disabled).');
      process.exit(0);
    }

    console.log('Starting database setup...');
    
    // Create database indexes
    const success = await createDatabaseIndexes();
    
    if (success) {
      console.log('Database setup completed successfully!');
    }
    process.exit(0);
  } catch (error) {
    // Check if it's a connection error that was already handled
    const isConnectionError = error.code === 'ECONNREFUSED' || 
                             error.message?.includes('ECONNREFUSED') ||
                             error.cause?.code === 'ECONNREFUSED';
    
    if (isConnectionError) {
      // Already handled in createDatabaseIndexes, exit gracefully
      process.exit(0);
    }
    
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main(); 