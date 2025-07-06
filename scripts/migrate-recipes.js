import { MongoClient } from 'mongodb';

async function migrateRecipes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const recipesCollection = db.collection('recipes');
    
    // Find all recipes that still have the old structure
    const oldRecipes = await recipesCollection.find({
      'ingredients.ingredients.foodItemId': { $exists: true }
    }).toArray();
    
    console.log(`Found ${oldRecipes.length} recipes to migrate`);
    
    for (const recipe of oldRecipes) {
      console.log(`Migrating recipe: ${recipe.title}`);
      
      // Update each ingredient list
      const updatedIngredients = recipe.ingredients.map(ingredientList => ({
        ...ingredientList,
        ingredients: ingredientList.ingredients.map(ingredient => {
          // Convert old structure to new structure
          return {
            type: 'foodItem', // All existing ingredients are food items
            id: ingredient.foodItemId, // Map foodItemId to id
            quantity: ingredient.quantity,
            unit: ingredient.unit
          };
        })
      }));
      
      // Update the recipe in the database
      await recipesCollection.updateOne(
        { _id: recipe._id },
        { 
          $set: { 
            ingredients: updatedIngredients,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`✓ Migrated recipe: ${recipe.title}`);
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrateRecipes(); 