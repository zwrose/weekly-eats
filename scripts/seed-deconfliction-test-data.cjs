#!/usr/bin/env node

/**
 * Seeds the worktree database with test data for unit deconfliction manual verification.
 *
 * Creates:
 * - Food items: Milk, Flour, Canned Tomatoes
 * - Recipe A (Pancakes): 2 cups milk, 3 cups flour
 * - Recipe B (Bechamel Sauce): 1 pint milk, 8 tablespoons flour
 * - Recipe C (Pasta Sauce): 2 cans tomatoes, 1 pound tomatoes (non-convertible)
 * - Meal plan with all three recipes
 *
 * Test scenarios:
 * - Milk: 2 cups + 1 pint → convertible, should auto-merge to ~3 cups
 * - Flour: 3 cups + 8 tablespoons → convertible, should auto-merge to ~3.5 cups
 * - Tomatoes: 2 cans + 1 pound → non-convertible, manual conflict
 *
 * Usage: node scripts/seed-deconfliction-test-data.cjs
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/weekly-eats-feature-smart-unit-deconfliction';

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log(`Connected to: ${db.databaseName}`);

    // Get existing user
    const user = await db.collection('users').findOne();
    if (!user) {
      console.error('No user found in database. Run the app and sign in first.');
      process.exit(1);
    }
    const userId = user._id.toString();
    console.log(`Using user: ${user.email} (${userId})`);

    // ---- Food Items ----
    const milkId = new ObjectId();
    const flourId = new ObjectId();
    const tomatoesId = new ObjectId();

    const foodItems = [
      {
        _id: milkId,
        userId,
        name: 'Milk',
        singularName: 'milk',
        pluralName: 'milk',
        unit: 'gallon',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: flourId,
        userId,
        name: 'Flour',
        singularName: 'flour',
        pluralName: 'flour',
        unit: 'pound',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: tomatoesId,
        userId,
        name: 'Canned Tomatoes',
        singularName: 'canned tomato',
        pluralName: 'canned tomatoes',
        unit: 'can',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.collection('foodItems').insertMany(foodItems);
    console.log('Inserted 3 food items');

    // ---- Recipes ----
    const recipeAId = new ObjectId();
    const recipeBId = new ObjectId();
    const recipeCId = new ObjectId();

    const recipes = [
      {
        _id: recipeAId,
        userId,
        title: 'Pancakes',
        ingredients: [
          {
            title: 'Ingredients',
            ingredients: [
              { type: 'foodItem', id: milkId.toString(), name: 'Milk', quantity: 2, unit: 'cup' },
              { type: 'foodItem', id: flourId.toString(), name: 'Flour', quantity: 3, unit: 'cup' },
            ],
          },
        ],
        instructions: [{ text: 'Mix and cook on griddle.' }],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: recipeBId,
        userId,
        title: 'Bechamel Sauce',
        ingredients: [
          {
            title: 'Ingredients',
            ingredients: [
              { type: 'foodItem', id: milkId.toString(), name: 'Milk', quantity: 1, unit: 'pint' },
              { type: 'foodItem', id: flourId.toString(), name: 'Flour', quantity: 8, unit: 'tablespoon' },
            ],
          },
        ],
        instructions: [{ text: 'Make a roux, add milk gradually.' }],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: recipeCId,
        userId,
        title: 'Pasta Sauce',
        ingredients: [
          {
            title: 'Ingredients',
            ingredients: [
              { type: 'foodItem', id: tomatoesId.toString(), name: 'Canned Tomatoes', quantity: 2, unit: 'can' },
              { type: 'foodItem', id: tomatoesId.toString(), name: 'Canned Tomatoes', quantity: 1, unit: 'pound' },
            ],
          },
        ],
        instructions: [{ text: 'Simmer tomatoes with herbs.' }],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.collection('recipes').insertMany(recipes);
    console.log('Inserted 3 recipes');

    // ---- Meal Plan Template ----
    const templateId = new ObjectId();
    const template = {
      _id: templateId,
      userId,
      startDay: 'saturday',
      meals: { breakfast: true, lunch: true, dinner: true, staples: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection('mealPlanTemplates').insertOne(template);

    // ---- Meal Plan ----
    const mealPlanId = new ObjectId();
    const mealPlan = {
      _id: mealPlanId,
      userId,
      name: 'Deconfliction Test Week',
      startDate: '2026-02-16',
      endDate: '2026-02-22',
      templateId: templateId.toString(),
      templateSnapshot: {
        startDay: 'saturday',
        meals: { breakfast: true, lunch: true, dinner: true, staples: false },
      },
      items: [
        {
          _id: new ObjectId(),
          mealPlanId: mealPlanId.toString(),
          dayOfWeek: 'saturday',
          mealType: 'dinner',
          items: [
            { type: 'recipe', id: recipeAId.toString(), name: 'Pancakes', quantity: 1 },
          ],
        },
        {
          _id: new ObjectId(),
          mealPlanId: mealPlanId.toString(),
          dayOfWeek: 'sunday',
          mealType: 'dinner',
          items: [
            { type: 'recipe', id: recipeBId.toString(), name: 'Bechamel Sauce', quantity: 1 },
          ],
        },
        {
          _id: new ObjectId(),
          mealPlanId: mealPlanId.toString(),
          dayOfWeek: 'monday',
          mealType: 'dinner',
          items: [
            { type: 'recipe', id: recipeCId.toString(), name: 'Pasta Sauce', quantity: 1 },
          ],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection('mealPlans').insertOne(mealPlan);
    console.log('Inserted meal plan: "Deconfliction Test Week"');

    console.log('\n--- Seed complete ---');
    console.log('Food Items:');
    console.log(`  Milk:   ${milkId}`);
    console.log(`  Flour:  ${flourId}`);
    console.log(`  Canned Tomatoes: ${tomatoesId}`);
    console.log('Recipes:');
    console.log(`  Pancakes:       ${recipeAId}`);
    console.log(`  Bechamel Sauce: ${recipeBId}`);
    console.log(`  Pasta Sauce:    ${recipeCId}`);
    console.log(`Meal Plan: ${mealPlanId}`);
    console.log('\nNow start the dev server and populate a shopping list from the "Deconfliction Test Week" meal plan.');
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
