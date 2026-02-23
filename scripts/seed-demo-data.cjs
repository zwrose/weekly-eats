#!/usr/bin/env node

/**
 * Seed script: populates the database with realistic demo data for UI testing.
 *
 * - Requires food items to be seeded first (run seed-food-items.cjs)
 * - Creates recipes, meal plans, stores, shopping lists, pantry items
 * - Idempotent: checks for existing data before inserting
 *
 * Usage:
 *   node scripts/seed-demo-data.cjs
 */

const { MongoClient, ObjectId } = require('mongodb');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');

function getMongoUri() {
  const envPath = resolve(projectRoot, '.env.local');
  if (!existsSync(envPath)) {
    console.error('Error: .env.local not found at', envPath);
    process.exit(1);
  }
  const content = readFileSync(envPath, 'utf8');
  const match = content.match(/^MONGODB_URI=(.+)$/m);
  if (!match) {
    console.error('Error: MONGODB_URI not found in .env.local');
    process.exit(1);
  }
  return match[1].trim();
}

async function main() {
  const uri = getMongoUri();
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    console.log('Connected to database:', db.databaseName);

    // Get the current user
    const user = await db.collection('users').findOne({});
    if (!user) {
      console.error('No user found. Please sign in first, then run this script.');
      process.exit(1);
    }
    const userId = user._id.toString();
    console.log(`Using user: ${user.name || user.email} (${userId})`);

    // Get food items for recipe ingredients
    const foodItems = await db.collection('foodItems').find({}).toArray();
    if (foodItems.length === 0) {
      console.error('No food items found. Run seed-food-items.cjs first.');
      process.exit(1);
    }
    console.log(`Found ${foodItems.length} food items`);

    const findFood = (name) => foodItems.find(fi =>
      fi.singularName?.toLowerCase() === name.toLowerCase() ||
      fi.name?.toLowerCase() === name.toLowerCase() ||
      fi.pluralName?.toLowerCase() === name.toLowerCase()
    );

    // ── RECIPES ──
    const existingRecipes = await db.collection('recipes').countDocuments({ createdBy: userId });
    let recipeIds = [];
    if (existingRecipes > 0) {
      console.log(`Skipping recipes (${existingRecipes} already exist)`);
      const recipes = await db.collection('recipes').find({ createdBy: userId }).toArray();
      recipeIds = recipes.map(r => r._id);
    } else {
      const now = new Date();
      const recipes = [
        {
          title: 'Classic Spaghetti Bolognese',
          emoji: '🍝',
          ingredients: [{
            ingredients: [
              { type: 'foodItem', id: findFood('Spaghetti')?._id?.toString() || '', quantity: 1, unit: 'pound', name: 'Spaghetti' },
              { type: 'foodItem', id: findFood('Ground Beef')?._id?.toString() || '', quantity: 1, unit: 'pound', name: 'Ground Beef' },
              { type: 'foodItem', id: findFood('Onion')?._id?.toString() || '', quantity: 1, unit: 'each', name: 'Onion' },
              { type: 'foodItem', id: findFood('Garlic')?._id?.toString() || '', quantity: 3, unit: 'clove', name: 'Garlic' },
              { type: 'foodItem', id: findFood('Tomato Sauce')?._id?.toString() || '', quantity: 2, unit: 'cup', name: 'Tomato Sauce' },
              { type: 'foodItem', id: findFood('Olive Oil')?._id?.toString() || '', quantity: 2, unit: 'tablespoon', name: 'Olive Oil' },
            ]
          }],
          instructions: '1. Cook spaghetti according to package directions.\n2. Brown ground beef in olive oil with diced onion.\n3. Add minced garlic and cook 1 minute.\n4. Add tomato sauce and simmer 20 minutes.\n5. Serve sauce over pasta.',
          isGlobal: false, createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          title: 'Chicken Stir Fry',
          emoji: '🥘',
          ingredients: [{
            ingredients: [
              { type: 'foodItem', id: findFood('Chicken Breast')?._id?.toString() || '', quantity: 1.5, unit: 'pound', name: 'Chicken Breast' },
              { type: 'foodItem', id: findFood('Bell Pepper')?._id?.toString() || '', quantity: 2, unit: 'each', name: 'Bell Pepper' },
              { type: 'foodItem', id: findFood('Broccoli')?._id?.toString() || '', quantity: 2, unit: 'cup', name: 'Broccoli' },
              { type: 'foodItem', id: findFood('Soy Sauce')?._id?.toString() || '', quantity: 3, unit: 'tablespoon', name: 'Soy Sauce' },
              { type: 'foodItem', id: findFood('Rice')?._id?.toString() || '', quantity: 2, unit: 'cup', name: 'Rice' },
              { type: 'foodItem', id: findFood('Sesame Oil')?._id?.toString() || '', quantity: 1, unit: 'tablespoon', name: 'Sesame Oil' },
            ]
          }],
          instructions: '1. Cook rice according to package.\n2. Cut chicken into bite-sized pieces.\n3. Stir fry chicken in sesame oil until cooked.\n4. Add vegetables and soy sauce.\n5. Serve over rice.',
          isGlobal: false, createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          title: 'Caesar Salad',
          emoji: '🥗',
          ingredients: [{
            ingredients: [
              { type: 'foodItem', id: findFood('Romaine Lettuce')?._id?.toString() || '', quantity: 1, unit: 'each', name: 'Romaine Lettuce' },
              { type: 'foodItem', id: findFood('Parmesan Cheese')?._id?.toString() || '', quantity: 0.5, unit: 'cup', name: 'Parmesan Cheese' },
              { type: 'foodItem', id: findFood('Lemon')?._id?.toString() || '', quantity: 1, unit: 'each', name: 'Lemon' },
              { type: 'foodItem', id: findFood('Garlic')?._id?.toString() || '', quantity: 2, unit: 'clove', name: 'Garlic' },
              { type: 'foodItem', id: findFood('Olive Oil')?._id?.toString() || '', quantity: 3, unit: 'tablespoon', name: 'Olive Oil' },
            ]
          }],
          instructions: '1. Wash and chop romaine.\n2. Make dressing: whisk olive oil, lemon juice, minced garlic, and parmesan.\n3. Toss salad with dressing.\n4. Top with extra parmesan.',
          isGlobal: false, createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          title: 'Banana Pancakes',
          emoji: '🥞',
          ingredients: [{
            ingredients: [
              { type: 'foodItem', id: findFood('Banana')?._id?.toString() || '', quantity: 2, unit: 'each', name: 'Banana' },
              { type: 'foodItem', id: findFood('Egg')?._id?.toString() || '', quantity: 3, unit: 'each', name: 'Egg' },
              { type: 'foodItem', id: findFood('Flour')?._id?.toString() || '', quantity: 1, unit: 'cup', name: 'Flour' },
              { type: 'foodItem', id: findFood('Milk')?._id?.toString() || '', quantity: 0.75, unit: 'cup', name: 'Milk' },
              { type: 'foodItem', id: findFood('Butter')?._id?.toString() || '', quantity: 2, unit: 'tablespoon', name: 'Butter' },
            ]
          }],
          instructions: '1. Mash bananas in a bowl.\n2. Whisk in eggs and milk.\n3. Add flour and mix until combined.\n4. Cook on buttered skillet over medium heat.\n5. Flip when bubbles form.',
          isGlobal: false, createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          title: 'Grilled Salmon',
          emoji: '🐟',
          ingredients: [{
            ingredients: [
              { type: 'foodItem', id: findFood('Salmon')?._id?.toString() || '', quantity: 4, unit: 'each', name: 'Salmon' },
              { type: 'foodItem', id: findFood('Lemon')?._id?.toString() || '', quantity: 2, unit: 'each', name: 'Lemon' },
              { type: 'foodItem', id: findFood('Olive Oil')?._id?.toString() || '', quantity: 2, unit: 'tablespoon', name: 'Olive Oil' },
              { type: 'foodItem', id: findFood('Garlic')?._id?.toString() || '', quantity: 3, unit: 'clove', name: 'Garlic' },
              { type: 'foodItem', id: findFood('Asparagus')?._id?.toString() || '', quantity: 1, unit: 'bunch', name: 'Asparagus' },
            ]
          }],
          instructions: '1. Marinate salmon with olive oil, lemon, and garlic.\n2. Grill salmon 4-5 min per side.\n3. Grill asparagus alongside.\n4. Serve with lemon wedges.',
          isGlobal: false, createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          title: 'Tacos',
          emoji: '🌮',
          ingredients: [{
            ingredients: [
              { type: 'foodItem', id: findFood('Ground Beef')?._id?.toString() || '', quantity: 1, unit: 'pound', name: 'Ground Beef' },
              { type: 'foodItem', id: findFood('Onion')?._id?.toString() || '', quantity: 1, unit: 'each', name: 'Onion' },
              { type: 'foodItem', id: findFood('Tomato')?._id?.toString() || '', quantity: 2, unit: 'each', name: 'Tomato' },
              { type: 'foodItem', id: findFood('Cheddar Cheese')?._id?.toString() || '', quantity: 1, unit: 'cup', name: 'Cheddar Cheese' },
              { type: 'foodItem', id: findFood('Sour Cream')?._id?.toString() || '', quantity: 0.5, unit: 'cup', name: 'Sour Cream' },
            ]
          }],
          instructions: '1. Brown ground beef with diced onion.\n2. Season with cumin, chili powder, and garlic.\n3. Dice tomatoes.\n4. Warm tortillas.\n5. Assemble tacos with toppings.',
          isGlobal: false, createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          title: 'Mushroom Risotto',
          emoji: '🍄',
          ingredients: [{
            ingredients: [
              { type: 'foodItem', id: findFood('Rice')?._id?.toString() || '', quantity: 1.5, unit: 'cup', name: 'Arborio Rice' },
              { type: 'foodItem', id: findFood('Mushroom')?._id?.toString() || '', quantity: 8, unit: 'ounce', name: 'Mushrooms' },
              { type: 'foodItem', id: findFood('Onion')?._id?.toString() || '', quantity: 1, unit: 'each', name: 'Onion' },
              { type: 'foodItem', id: findFood('Parmesan Cheese')?._id?.toString() || '', quantity: 0.5, unit: 'cup', name: 'Parmesan Cheese' },
              { type: 'foodItem', id: findFood('Butter')?._id?.toString() || '', quantity: 3, unit: 'tablespoon', name: 'Butter' },
              { type: 'foodItem', id: findFood('Garlic')?._id?.toString() || '', quantity: 2, unit: 'clove', name: 'Garlic' },
            ]
          }],
          instructions: '1. Sauté mushrooms in butter.\n2. Cook onion and garlic.\n3. Toast rice, add broth one ladle at a time.\n4. Stir frequently for 20 minutes.\n5. Finish with parmesan and butter.',
          isGlobal: false, createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          title: 'Greek Yogurt Bowl',
          emoji: '🫐',
          ingredients: [{
            ingredients: [
              { type: 'foodItem', id: findFood('Greek Yogurt')?._id?.toString() || '', quantity: 1, unit: 'cup', name: 'Greek Yogurt' },
              { type: 'foodItem', id: findFood('Blueberry')?._id?.toString() || '', quantity: 0.5, unit: 'cup', name: 'Blueberries' },
              { type: 'foodItem', id: findFood('Honey')?._id?.toString() || '', quantity: 1, unit: 'tablespoon', name: 'Honey' },
              { type: 'foodItem', id: findFood('Almond')?._id?.toString() || '', quantity: 0.25, unit: 'cup', name: 'Almonds' },
            ]
          }],
          instructions: '1. Spoon yogurt into bowl.\n2. Top with blueberries and almonds.\n3. Drizzle with honey.',
          isGlobal: false, createdBy: userId, createdAt: now, updatedAt: now,
        },
      ];

      const result = await db.collection('recipes').insertMany(recipes);
      recipeIds = Object.values(result.insertedIds);
      console.log(`Inserted ${recipes.length} recipes`);

      // Add recipe user data (tags, ratings)
      const recipeUserData = [
        { userId, recipeId: recipeIds[0].toString(), tags: ['Italian', 'Comfort Food', 'Quick'], rating: 5 },
        { userId, recipeId: recipeIds[1].toString(), tags: ['Asian', 'Healthy', 'Quick'], rating: 4 },
        { userId, recipeId: recipeIds[2].toString(), tags: ['Salad', 'Healthy', 'Light'], rating: 4 },
        { userId, recipeId: recipeIds[3].toString(), tags: ['Breakfast', 'Sweet'], rating: 5 },
        { userId, recipeId: recipeIds[4].toString(), tags: ['Seafood', 'Healthy', 'Grilling'], rating: 5 },
        { userId, recipeId: recipeIds[5].toString(), tags: ['Mexican', 'Quick', 'Family'], rating: 4 },
        { userId, recipeId: recipeIds[6].toString(), tags: ['Italian', 'Comfort Food'], rating: 3 },
        { userId, recipeId: recipeIds[7].toString(), tags: ['Breakfast', 'Healthy', 'Quick'], rating: 4 },
      ];
      await db.collection('recipeUserData').insertMany(recipeUserData);
      console.log(`Inserted ${recipeUserData.length} recipe user data entries`);
    }

    // ── MEAL PLAN TEMPLATE ──
    const existingTemplate = await db.collection('mealPlanTemplates').findOne({ userId });
    let templateId;
    if (existingTemplate) {
      templateId = existingTemplate._id;
      console.log('Skipping template (already exists)');
    } else {
      const template = {
        userId,
        startDay: 'monday',
        meals: { breakfast: true, lunch: true, dinner: true, staples: true },
        weeklyStaples: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await db.collection('mealPlanTemplates').insertOne(template);
      templateId = result.insertedId;
      console.log('Inserted meal plan template');
    }

    // ── MEAL PLAN ──
    const existingPlan = await db.collection('mealPlans').countDocuments({ userId });
    if (existingPlan > 0) {
      console.log(`Skipping meal plans (${existingPlan} already exist)`);
    } else {
      // Create a current week meal plan
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const formatDate = (d) => d.toISOString().split('T')[0];

      const recipes = await db.collection('recipes').find({ createdBy: userId }).toArray();

      const mealPlan = {
        userId,
        name: `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        startDate: formatDate(monday),
        endDate: formatDate(sunday),
        templateId: templateId.toString(),
        templateSnapshot: { startDay: 'monday', meals: { breakfast: true, lunch: true, dinner: true, staples: true } },
        items: [
          { _id: new ObjectId().toString(), mealPlanId: '', dayOfWeek: 'monday', mealType: 'breakfast', items: [{ type: 'recipe', id: recipes[3]?._id?.toString() || '', name: recipes[3]?.title || 'Banana Pancakes' }] },
          { _id: new ObjectId().toString(), mealPlanId: '', dayOfWeek: 'monday', mealType: 'dinner', items: [{ type: 'recipe', id: recipes[0]?._id?.toString() || '', name: recipes[0]?.title || 'Spaghetti Bolognese' }] },
          { _id: new ObjectId().toString(), mealPlanId: '', dayOfWeek: 'tuesday', mealType: 'dinner', items: [{ type: 'recipe', id: recipes[1]?._id?.toString() || '', name: recipes[1]?.title || 'Chicken Stir Fry' }] },
          { _id: new ObjectId().toString(), mealPlanId: '', dayOfWeek: 'wednesday', mealType: 'lunch', items: [{ type: 'recipe', id: recipes[2]?._id?.toString() || '', name: recipes[2]?.title || 'Caesar Salad' }] },
          { _id: new ObjectId().toString(), mealPlanId: '', dayOfWeek: 'wednesday', mealType: 'dinner', items: [{ type: 'recipe', id: recipes[4]?._id?.toString() || '', name: recipes[4]?.title || 'Grilled Salmon' }] },
          { _id: new ObjectId().toString(), mealPlanId: '', dayOfWeek: 'thursday', mealType: 'dinner', items: [{ type: 'recipe', id: recipes[5]?._id?.toString() || '', name: recipes[5]?.title || 'Tacos' }] },
          { _id: new ObjectId().toString(), mealPlanId: '', dayOfWeek: 'friday', mealType: 'dinner', items: [{ type: 'recipe', id: recipes[6]?._id?.toString() || '', name: recipes[6]?.title || 'Mushroom Risotto' }] },
          { _id: new ObjectId().toString(), mealPlanId: '', dayOfWeek: 'saturday', mealType: 'breakfast', items: [{ type: 'recipe', id: recipes[7]?._id?.toString() || '', name: recipes[7]?.title || 'Greek Yogurt Bowl' }] },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const planResult = await db.collection('mealPlans').insertOne(mealPlan);
      // Update mealPlanId references
      const planId = planResult.insertedId.toString();
      await db.collection('mealPlans').updateOne(
        { _id: planResult.insertedId },
        { $set: { 'items.$[].mealPlanId': planId } }
      );
      console.log('Inserted meal plan for current week');
    }

    // ── STORES & SHOPPING LISTS ──
    const existingStores = await db.collection('stores').countDocuments({ userId });
    if (existingStores > 0) {
      console.log(`Skipping stores (${existingStores} already exist)`);
    } else {
      const stores = [
        { userId, name: 'Costco', emoji: '🏪', invitations: [], createdAt: new Date(), updatedAt: new Date() },
        { userId, name: 'Trader Joe\'s', emoji: '🛒', invitations: [], createdAt: new Date(), updatedAt: new Date() },
        { userId, name: 'Whole Foods', emoji: '🥑', invitations: [], createdAt: new Date(), updatedAt: new Date() },
      ];
      const storeResult = await db.collection('stores').insertMany(stores);
      const storeIds = Object.values(storeResult.insertedIds);
      console.log('Inserted 3 stores');

      // Create shopping lists for first two stores
      const shoppingLists = [
        {
          storeId: storeIds[0].toString(),
          userId,
          items: [
            { foodItemId: findFood('Chicken Breast')?._id?.toString() || '', name: 'Chicken Breast', quantity: 3, unit: 'pound', checked: false },
            { foodItemId: findFood('Rice')?._id?.toString() || '', name: 'Rice', quantity: 5, unit: 'pound', checked: false },
            { foodItemId: findFood('Olive Oil')?._id?.toString() || '', name: 'Olive Oil', quantity: 1, unit: 'each', checked: true },
            { foodItemId: findFood('Butter')?._id?.toString() || '', name: 'Butter', quantity: 2, unit: 'each', checked: false },
            { foodItemId: findFood('Egg')?._id?.toString() || '', name: 'Eggs', quantity: 2, unit: 'dozen', checked: false },
            { foodItemId: findFood('Milk')?._id?.toString() || '', name: 'Milk', quantity: 1, unit: 'gallon', checked: true },
          ],
          createdAt: new Date(), updatedAt: new Date(),
        },
        {
          storeId: storeIds[1].toString(),
          userId,
          items: [
            { foodItemId: findFood('Banana')?._id?.toString() || '', name: 'Bananas', quantity: 6, unit: 'each', checked: false },
            { foodItemId: findFood('Blueberry')?._id?.toString() || '', name: 'Blueberries', quantity: 2, unit: 'pint', checked: false },
            { foodItemId: findFood('Greek Yogurt')?._id?.toString() || '', name: 'Greek Yogurt', quantity: 2, unit: 'each', checked: false },
            { foodItemId: findFood('Salmon')?._id?.toString() || '', name: 'Salmon', quantity: 1, unit: 'pound', checked: false },
          ],
          createdAt: new Date(), updatedAt: new Date(),
        },
      ];
      await db.collection('shoppingLists').insertMany(shoppingLists);
      console.log('Inserted 2 shopping lists');
    }

    // ── PANTRY ──
    const existingPantry = await db.collection('pantry').countDocuments({ userId });
    if (existingPantry > 0) {
      console.log(`Skipping pantry (${existingPantry} items already exist)`);
    } else {
      const pantryItemNames = [
        'Olive Oil', 'Salt', 'Black Pepper', 'Garlic', 'Onion', 'Butter',
        'Flour', 'Sugar', 'Soy Sauce', 'Rice', 'Pasta', 'Egg',
        'Milk', 'Cheddar Cheese', 'Parmesan Cheese', 'Lemon',
        'Tomato Sauce', 'Honey', 'Sesame Oil', 'Cumin',
      ];
      const pantryItems = pantryItemNames
        .map(name => findFood(name))
        .filter(Boolean)
        .map(fi => ({ userId, foodItemId: fi._id.toString() }));

      if (pantryItems.length > 0) {
        await db.collection('pantry').insertMany(pantryItems);
        console.log(`Inserted ${pantryItems.length} pantry items`);
      }
    }

    console.log('\nDone! Demo data has been seeded.');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
