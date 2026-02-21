#!/usr/bin/env node

/**
 * Seed script: populates the foodItems collection with 220+ realistic items.
 *
 * - Inserts directly into MongoDB (bypasses API)
 * - Idempotent: skips items whose singularName already exists (case-insensitive)
 * - All items are global (isGlobal: true)
 *
 * Usage:
 *   node scripts/seed-food-items.cjs                     # owner = first user in DB
 *   node scripts/seed-food-items.cjs --user-id=<id>      # owner = specified user
 */

const { MongoClient } = require('mongodb');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');

const projectRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Read MONGODB_URI from .env.local
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 2. Parse --user-id flag
// ---------------------------------------------------------------------------
function parseUserId() {
  const arg = process.argv.find(a => a.startsWith('--user-id='));
  return arg ? arg.split('=')[1] : null;
}

// ---------------------------------------------------------------------------
// 3. Food item data — 220+ items, every letter A-Z represented
// ---------------------------------------------------------------------------
// Each entry: [singularName, pluralName, unit]
// `name` (display name) is set to pluralName.
const FOOD_ITEMS = [
  // ── A ──
  ['Acorn Squash', 'Acorn Squash', 'each'],
  ['Almond', 'Almonds', 'cup'],
  ['Almond Butter', 'Almond Butter', 'tablespoon'],
  ['Almond Milk', 'Almond Milk', 'cup'],
  ['Anchovy', 'Anchovies', 'each'],
  ['Apple', 'Apples', 'each'],
  ['Apple Cider Vinegar', 'Apple Cider Vinegar', 'tablespoon'],
  ['Apricot', 'Apricots', 'each'],
  ['Artichoke', 'Artichokes', 'each'],
  ['Arugula', 'Arugula', 'cup'],
  ['Asparagus', 'Asparagus', 'bunch'],
  ['Avocado', 'Avocados', 'each'],

  // ── B ──
  ['Bacon', 'Bacon', 'slice'],
  ['Balsamic Vinegar', 'Balsamic Vinegar', 'tablespoon'],
  ['Banana', 'Bananas', 'each'],
  ['Basil', 'Basil', 'cup'],
  ['Bay Leaf', 'Bay Leaves', 'each'],
  ['Bean Sprout', 'Bean Sprouts', 'cup'],
  ['Beef Broth', 'Beef Broth', 'cup'],
  ['Beef Chuck Roast', 'Beef Chuck Roasts', 'pound'],
  ['Beef Ground', 'Beef Ground', 'pound'],
  ['Beef Steak', 'Beef Steaks', 'pound'],
  ['Beet', 'Beets', 'each'],
  ['Bell Pepper', 'Bell Peppers', 'each'],
  ['Black Bean', 'Black Beans', 'can'],
  ['Black Pepper', 'Black Pepper', 'teaspoon'],
  ['Blackberry', 'Blackberries', 'cup'],
  ['Blueberry', 'Blueberries', 'cup'],
  ['Bok Choy', 'Bok Choy', 'head'],
  ['Bread', 'Bread', 'loaf'],
  ['Bread Crumb', 'Bread Crumbs', 'cup'],
  ['Broccoli', 'Broccoli', 'head'],
  ['Brown Rice', 'Brown Rice', 'cup'],
  ['Brown Sugar', 'Brown Sugar', 'cup'],
  ['Brussels Sprout', 'Brussels Sprouts', 'cup'],
  ['Butter', 'Butter', 'tablespoon'],
  ['Butternut Squash', 'Butternut Squash', 'each'],

  // ── C ──
  ['Cabbage', 'Cabbage', 'head'],
  ['Cannellini Bean', 'Cannellini Beans', 'can'],
  ['Caper', 'Capers', 'tablespoon'],
  ['Carrot', 'Carrots', 'each'],
  ['Cashew', 'Cashews', 'cup'],
  ['Cauliflower', 'Cauliflower', 'head'],
  ['Cayenne Pepper', 'Cayenne Pepper', 'teaspoon'],
  ['Celery', 'Celery', 'stalk'],
  ['Cheddar Cheese', 'Cheddar Cheese', 'cup'],
  ['Cherry', 'Cherries', 'cup'],
  ['Cherry Tomato', 'Cherry Tomatoes', 'cup'],
  ['Chicken Breast', 'Chicken Breasts', 'pound'],
  ['Chicken Broth', 'Chicken Broth', 'cup'],
  ['Chicken Thigh', 'Chicken Thighs', 'pound'],
  ['Chickpea', 'Chickpeas', 'can'],
  ['Chili Flake', 'Chili Flakes', 'teaspoon'],
  ['Chili Powder', 'Chili Powder', 'teaspoon'],
  ['Chive', 'Chives', 'tablespoon'],
  ['Chocolate Chip', 'Chocolate Chips', 'cup'],
  ['Cilantro', 'Cilantro', 'bunch'],
  ['Cinnamon', 'Cinnamon', 'teaspoon'],
  ['Clove', 'Cloves', 'clove'],
  ['Cocoa Powder', 'Cocoa Powder', 'tablespoon'],
  ['Coconut Cream', 'Coconut Cream', 'can'],
  ['Coconut Milk', 'Coconut Milk', 'can'],
  ['Coconut Oil', 'Coconut Oil', 'tablespoon'],
  ['Cod', 'Cod', 'pound'],
  ['Corn', 'Corn', 'ear'],
  ['Corn Tortilla', 'Corn Tortillas', 'each'],
  ['Cornstarch', 'Cornstarch', 'tablespoon'],
  ['Cottage Cheese', 'Cottage Cheese', 'cup'],
  ['Couscous', 'Couscous', 'cup'],
  ['Cranberry', 'Cranberries', 'cup'],
  ['Cream Cheese', 'Cream Cheese', 'ounce'],
  ['Cucumber', 'Cucumbers', 'each'],
  ['Cumin', 'Cumin', 'teaspoon'],
  ['Curry Powder', 'Curry Powder', 'teaspoon'],

  // ── D ──
  ['Date', 'Dates', 'each'],
  ['Dijon Mustard', 'Dijon Mustard', 'tablespoon'],
  ['Dill', 'Dill', 'tablespoon'],
  ['Dried Oregano', 'Dried Oregano', 'teaspoon'],
  ['Dried Thyme', 'Dried Thyme', 'teaspoon'],
  ['Duck Breast', 'Duck Breasts', 'each'],

  // ── E ──
  ['Edamame', 'Edamame', 'cup'],
  ['Egg', 'Eggs', 'each'],
  ['Egg Noodle', 'Egg Noodles', 'cup'],
  ['Eggplant', 'Eggplants', 'each'],
  ['Elbow Macaroni', 'Elbow Macaroni', 'cup'],
  ['Enchilada Sauce', 'Enchilada Sauce', 'can'],
  ['Endive', 'Endives', 'head'],
  ['Evaporated Milk', 'Evaporated Milk', 'can'],

  // ── F ──
  ['Farro', 'Farro', 'cup'],
  ['Fennel', 'Fennel', 'each'],
  ['Feta Cheese', 'Feta Cheese', 'cup'],
  ['Fig', 'Figs', 'each'],
  ['Fish Sauce', 'Fish Sauce', 'tablespoon'],
  ['Flat-Leaf Parsley', 'Flat-Leaf Parsley', 'cup'],
  ['Flour', 'Flour', 'cup'],
  ['Flour Tortilla', 'Flour Tortillas', 'each'],
  ['Fresh Ginger', 'Fresh Ginger', 'tablespoon'],
  ['Fresh Mozzarella', 'Fresh Mozzarella', 'ounce'],

  // ── G ──
  ['Garbanzo Bean', 'Garbanzo Beans', 'can'],
  ['Garlic', 'Garlic', 'clove'],
  ['Ginger', 'Ginger', 'teaspoon'],
  ['Goat Cheese', 'Goat Cheese', 'ounce'],
  ['Golden Raisin', 'Golden Raisins', 'cup'],
  ['Grape', 'Grapes', 'cup'],
  ['Grape Tomato', 'Grape Tomatoes', 'cup'],
  ['Grapefruit', 'Grapefruits', 'each'],
  ['Greek Yogurt', 'Greek Yogurt', 'cup'],
  ['Green Bean', 'Green Beans', 'cup'],
  ['Green Onion', 'Green Onions', 'each'],
  ['Gruyere Cheese', 'Gruyere Cheese', 'cup'],

  // ── H ──
  ['Half and Half', 'Half and Half', 'cup'],
  ['Ham', 'Ham', 'pound'],
  ['Heavy Cream', 'Heavy Cream', 'cup'],
  ['Honey', 'Honey', 'tablespoon'],
  ['Hot Sauce', 'Hot Sauce', 'teaspoon'],
  ['Hummus', 'Hummus', 'cup'],

  // ── I ──
  ['Ice Cream', 'Ice Cream', 'cup'],
  ['Italian Sausage', 'Italian Sausages', 'each'],
  ['Italian Seasoning', 'Italian Seasoning', 'teaspoon'],

  // ── J ──
  ['Jalapeno', 'Jalapenos', 'each'],
  ['Jam', 'Jam', 'tablespoon'],
  ['Jasmine Rice', 'Jasmine Rice', 'cup'],
  ['Jicama', 'Jicama', 'each'],

  // ── K ──
  ['Kale', 'Kale', 'bunch'],
  ['Ketchup', 'Ketchup', 'tablespoon'],
  ['Kidney Bean', 'Kidney Beans', 'can'],
  ['Kimchi', 'Kimchi', 'cup'],
  ['Kielbasa', 'Kielbasa', 'pound'],

  // ── L ──
  ['Lamb Chop', 'Lamb Chops', 'pound'],
  ['Leek', 'Leeks', 'each'],
  ['Lemon', 'Lemons', 'each'],
  ['Lemon Juice', 'Lemon Juice', 'tablespoon'],
  ['Lentil', 'Lentils', 'cup'],
  ['Lettuce', 'Lettuce', 'head'],
  ['Lime', 'Limes', 'each'],
  ['Lime Juice', 'Lime Juice', 'tablespoon'],

  // ── M ──
  ['Mango', 'Mangoes', 'each'],
  ['Maple Syrup', 'Maple Syrup', 'tablespoon'],
  ['Marinara Sauce', 'Marinara Sauce', 'cup'],
  ['Mayonnaise', 'Mayonnaise', 'tablespoon'],
  ['Milk', 'Milk', 'cup'],
  ['Mint', 'Mint', 'tablespoon'],
  ['Miso Paste', 'Miso Paste', 'tablespoon'],
  ['Monterey Jack Cheese', 'Monterey Jack Cheese', 'cup'],
  ['Mushroom', 'Mushrooms', 'cup'],
  ['Mustard', 'Mustard', 'tablespoon'],

  // ── N ──
  ['Naan Bread', 'Naan Breads', 'each'],
  ['Navy Bean', 'Navy Beans', 'can'],
  ['Nectarine', 'Nectarines', 'each'],
  ['Nutmeg', 'Nutmeg', 'teaspoon'],

  // ── O ──
  ['Oat', 'Oats', 'cup'],
  ['Olive', 'Olives', 'cup'],
  ['Olive Oil', 'Olive Oil', 'tablespoon'],
  ['Onion', 'Onions', 'each'],
  ['Orange', 'Oranges', 'each'],
  ['Orange Juice', 'Orange Juice', 'cup'],
  ['Oregano', 'Oregano', 'teaspoon'],

  // ── P ──
  ['Pancetta', 'Pancetta', 'ounce'],
  ['Panko Bread Crumbs', 'Panko Bread Crumbs', 'cup'],
  ['Paprika', 'Paprika', 'teaspoon'],
  ['Parmesan Cheese', 'Parmesan Cheese', 'cup'],
  ['Parsley', 'Parsley', 'tablespoon'],
  ['Parsnip', 'Parsnips', 'each'],
  ['Pasta', 'Pasta', 'pound'],
  ['Peach', 'Peaches', 'each'],
  ['Peanut', 'Peanuts', 'cup'],
  ['Peanut Butter', 'Peanut Butter', 'tablespoon'],
  ['Pear', 'Pears', 'each'],
  ['Peas', 'Peas', 'cup'],
  ['Pecan', 'Pecans', 'cup'],
  ['Penne Pasta', 'Penne Pasta', 'cup'],
  ['Pepper Jack Cheese', 'Pepper Jack Cheese', 'cup'],
  ['Pickle', 'Pickles', 'each'],
  ['Pine Nut', 'Pine Nuts', 'tablespoon'],
  ['Pineapple', 'Pineapples', 'each'],
  ['Pinto Bean', 'Pinto Beans', 'can'],
  ['Pistachio', 'Pistachios', 'cup'],
  ['Pita Bread', 'Pita Breads', 'each'],
  ['Plum', 'Plums', 'each'],
  ['Poblano Pepper', 'Poblano Peppers', 'each'],
  ['Polenta', 'Polenta', 'cup'],
  ['Pork Chop', 'Pork Chops', 'each'],
  ['Pork Loin', 'Pork Loin', 'pound'],
  ['Pork Tenderloin', 'Pork Tenderloin', 'pound'],
  ['Potato', 'Potatoes', 'each'],
  ['Prosciutto', 'Prosciutto', 'ounce'],
  ['Pumpkin', 'Pumpkin', 'can'],

  // ── Q ──
  ['Quinoa', 'Quinoa', 'cup'],
  ['Queso Fresco', 'Queso Fresco', 'cup'],

  // ── R ──
  ['Radish', 'Radishes', 'each'],
  ['Raisin', 'Raisins', 'cup'],
  ['Raspberry', 'Raspberries', 'cup'],
  ['Red Onion', 'Red Onions', 'each'],
  ['Red Pepper Flake', 'Red Pepper Flakes', 'teaspoon'],
  ['Red Wine Vinegar', 'Red Wine Vinegar', 'tablespoon'],
  ['Refried Bean', 'Refried Beans', 'can'],
  ['Rice', 'Rice', 'cup'],
  ['Rice Vinegar', 'Rice Vinegar', 'tablespoon'],
  ['Ricotta Cheese', 'Ricotta Cheese', 'cup'],
  ['Romaine Lettuce', 'Romaine Lettuce', 'head'],
  ['Rosemary', 'Rosemary', 'teaspoon'],
  ['Rotini Pasta', 'Rotini Pasta', 'cup'],

  // ── S ──
  ['Sage', 'Sage', 'teaspoon'],
  ['Salmon', 'Salmon', 'pound'],
  ['Salsa', 'Salsa', 'cup'],
  ['Salt', 'Salt', 'teaspoon'],
  ['Sausage', 'Sausages', 'each'],
  ['Sesame Oil', 'Sesame Oil', 'tablespoon'],
  ['Sesame Seed', 'Sesame Seeds', 'tablespoon'],
  ['Shallot', 'Shallots', 'each'],
  ['Shrimp', 'Shrimp', 'pound'],
  ['Smoked Paprika', 'Smoked Paprika', 'teaspoon'],
  ['Snow Pea', 'Snow Peas', 'cup'],
  ['Sour Cream', 'Sour Cream', 'cup'],
  ['Soy Sauce', 'Soy Sauce', 'tablespoon'],
  ['Spaghetti', 'Spaghetti', 'pound'],
  ['Spinach', 'Spinach', 'cup'],
  ['Sriracha', 'Sriracha', 'teaspoon'],
  ['Strawberry', 'Strawberries', 'cup'],
  ['Sugar', 'Sugar', 'cup'],
  ['Sun-Dried Tomato', 'Sun-Dried Tomatoes', 'cup'],
  ['Sunflower Seed', 'Sunflower Seeds', 'cup'],
  ['Sweet Potato', 'Sweet Potatoes', 'each'],
  ['Swiss Cheese', 'Swiss Cheese', 'cup'],

  // ── T ──
  ['Taco Seasoning', 'Taco Seasoning', 'tablespoon'],
  ['Tahini', 'Tahini', 'tablespoon'],
  ['Tamari', 'Tamari', 'tablespoon'],
  ['Thyme', 'Thyme', 'teaspoon'],
  ['Tilapia', 'Tilapia', 'pound'],
  ['Tofu', 'Tofu', 'ounce'],
  ['Tomato', 'Tomatoes', 'each'],
  ['Tomato Paste', 'Tomato Paste', 'tablespoon'],
  ['Tomato Sauce', 'Tomato Sauce', 'can'],
  ['Tuna', 'Tuna', 'can'],
  ['Turkey Breast', 'Turkey Breasts', 'pound'],
  ['Turkey Ground', 'Turkey Ground', 'pound'],
  ['Turmeric', 'Turmeric', 'teaspoon'],
  ['Turnip', 'Turnips', 'each'],

  // ── U ──
  ['Udon Noodle', 'Udon Noodles', 'cup'],

  // ── V ──
  ['Vanilla Extract', 'Vanilla Extract', 'teaspoon'],
  ['Vegetable Broth', 'Vegetable Broth', 'cup'],
  ['Vegetable Oil', 'Vegetable Oil', 'tablespoon'],

  // ── W ──
  ['Walnut', 'Walnuts', 'cup'],
  ['Water Chestnut', 'Water Chestnuts', 'can'],
  ['Watercress', 'Watercress', 'cup'],
  ['Watermelon', 'Watermelon', 'cup'],
  ['White Bean', 'White Beans', 'can'],
  ['White Wine', 'White Wine', 'cup'],
  ['Whole Wheat Flour', 'Whole Wheat Flour', 'cup'],
  ['Worcestershire Sauce', 'Worcestershire Sauce', 'tablespoon'],

  // ── X ──
  ['Xanthan Gum', 'Xanthan Gum', 'teaspoon'],

  // ── Y ──
  ['Yam', 'Yams', 'each'],
  ['Yellow Onion', 'Yellow Onions', 'each'],
  ['Yellow Squash', 'Yellow Squash', 'each'],
  ['Yogurt', 'Yogurt', 'cup'],

  // ── Z ──
  ['Zucchini', 'Zucchini', 'each'],
  ['Za\'atar', 'Za\'atar', 'teaspoon'],
];

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------
async function main() {
  const uri = getMongoUri();
  const explicitUserId = parseUserId();

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    // Resolve user ID
    let userId = explicitUserId;
    if (!userId) {
      const user = await db.collection('users').findOne({});
      if (!user) {
        console.error('Error: No users found in database. Create a user first or pass --user-id=<id>.');
        process.exit(1);
      }
      userId = user._id.toString();
      console.log('Using user:', user.name || user.email || userId);
    } else {
      console.log('Using user ID:', userId);
    }

    const collection = db.collection('foodItems');

    // Fetch existing singularNames for idempotency (case-insensitive)
    const existingDocs = await collection
      .find({}, { projection: { singularName: 1 } })
      .toArray();
    const existingNames = new Set(
      existingDocs.map(d => d.singularName.toLowerCase())
    );

    const now = new Date();
    const toInsert = [];

    for (const [singularName, pluralName, unit] of FOOD_ITEMS) {
      if (existingNames.has(singularName.toLowerCase())) {
        continue;
      }
      toInsert.push({
        name: pluralName,
        singularName,
        pluralName,
        unit,
        isGlobal: true,
        isApproved: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    const skipped = FOOD_ITEMS.length - toInsert.length;

    if (toInsert.length > 0) {
      const result = await collection.insertMany(toInsert);
      console.log(`Inserted ${result.insertedCount} food items (${skipped} already existed).`);
    } else {
      console.log(`Nothing to insert — all ${FOOD_ITEMS.length} items already exist.`);
    }

    const total = await collection.countDocuments();
    console.log(`Total food items in database: ${total}`);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
