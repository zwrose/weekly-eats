/* eslint-disable @typescript-eslint/no-var-requires */
const { MongoClient } = require('mongodb');

async function migrateMealPlans() {
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
    const mealPlansCollection = db.collection('mealPlans');
    const templatesCollection = db.collection('mealPlanTemplates');

    // Find all meal plans that don't have templateSnapshot
    const mealPlansToUpdate = await mealPlansCollection.find({
      templateSnapshot: { $exists: false }
    }).toArray();

    console.log(`Found ${mealPlansToUpdate.length} meal plans to migrate`);

    for (const mealPlan of mealPlansToUpdate) {
      try {
        // Get the template that was used when this meal plan was created
        const template = await templatesCollection.findOne({
          _id: new MongoClient.ObjectId(mealPlan.templateId)
        });

        if (!template) {
          console.warn(`Template not found for meal plan ${mealPlan._id}, using default template`);
          // Use default template if the original template is missing
          const defaultTemplate = {
            startDay: 'saturday',
            meals: {
              breakfast: true,
              lunch: true,
              dinner: true
            }
          };

          await mealPlansCollection.updateOne(
            { _id: mealPlan._id },
            { 
              $set: { 
                templateSnapshot: defaultTemplate,
                updatedAt: new Date()
              } 
            }
          );
        } else {
          // Use the current template settings as the snapshot
          const templateSnapshot = {
            startDay: template.startDay,
            meals: template.meals
          };

          await mealPlansCollection.updateOne(
            { _id: mealPlan._id },
            { 
              $set: { 
                templateSnapshot: templateSnapshot,
                updatedAt: new Date()
              } 
            }
          );
        }

        console.log(`Migrated meal plan ${mealPlan._id}`);
      } catch (error) {
        console.error(`Error migrating meal plan ${mealPlan._id}:`, error);
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateMealPlans();
}

module.exports = { migrateMealPlans }; 