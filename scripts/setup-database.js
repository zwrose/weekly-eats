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
  
  try {
    await client.connect();
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
  } catch (error) {
    console.error('Error creating database indexes:', error);
    throw error;
  } finally {
    await client.close();
  }
}

async function main() {
  try {
    console.log('Starting database setup...');
    
    // Create database indexes
    await createDatabaseIndexes();
    
    console.log('Database setup completed successfully!');
    process.exit(0);
  } catch (error) {
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