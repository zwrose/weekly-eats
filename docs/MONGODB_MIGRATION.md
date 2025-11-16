# MongoDB Migration Guide

This guide explains how to migrate your MongoDB data from your old machine to your new one.

## Quick Start

### On Your Old Machine

1. **Export your MongoDB data:**
   ```bash
   ./scripts/migrate-mongodb.sh export
   ```
   
   This creates a compressed archive: `mongodb-dump.tar.gz`

2. **Transfer the archive to your new machine:**
   - Using USB drive
   - Using `scp`: `scp mongodb-dump.tar.gz user@new-machine:/path/to/weekly-eats/`
   - Using cloud storage (Google Drive, Dropbox, etc.)
   - Using `rsync` over network

### On Your New Machine

1. **Extract the archive:**
   ```bash
   tar -xzf mongodb-dump.tar.gz
   ```

2. **Make sure MongoDB is installed and running:**
   ```bash
   ./scripts/setup-ubuntu.sh
   # or manually:
   sudo systemctl start mongod
   ```

3. **Import the data:**
   ```bash
   ./scripts/migrate-mongodb.sh import ./mongodb-dump
   ```

4. **Recreate database indexes:**
   ```bash
   npm run setup-db
   ```

5. **Verify the import:**
   ```bash
   mongosh weekly-eats
   # Then in the MongoDB shell:
   show collections
   db.mealPlans.countDocuments()
   ```

## Manual Method (Alternative)

If you prefer to do it manually or the script doesn't work:

### Export (Old Machine)

```bash
# Export entire database
mongodump --db=weekly-eats --out=./mongodb-dump

# Or export specific collections
mongodump --db=weekly-eats --collection=mealPlans --out=./mongodb-dump
mongodump --db=weekly-eats --collection=recipes --out=./mongodb-dump
mongodump --db=weekly-eats --collection=foodItems --out=./mongodb-dump
mongodump --db=weekly-eats --collection=pantry --out=./mongodb-dump
mongodump --db=weekly-eats --collection=users --out=./mongodb-dump

# Create compressed archive
tar -czf mongodb-dump.tar.gz mongodb-dump/
```

### Import (New Machine)

```bash
# Extract the archive
tar -xzf mongodb-dump.tar.gz

# Import the database (--drop removes existing data first)
mongorestore --db=weekly-eats --drop ./mongodb-dump/weekly-eats

# Recreate indexes
npm run setup-db
```

## Troubleshooting

### "mongodump: command not found"

Install MongoDB database tools:
```bash
sudo apt-get install -y mongodb-database-tools
```

### "Connection refused" during import

Make sure MongoDB is running:
```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

### Database name mismatch

If your old database had a different name, specify it:
```bash
# Export with custom name
MONGODB_DB_NAME=my-old-db-name ./scripts/migrate-mongodb.sh export

# Import with custom name
MONGODB_DB_NAME=my-old-db-name ./scripts/migrate-mongodb.sh import ./mongodb-dump
```

### Partial migration

If you only want to migrate specific collections:

```bash
# Export specific collection
mongodump --db=weekly-eats --collection=recipes --out=./mongodb-dump

# Import specific collection
mongorestore --db=weekly-eats --collection=recipes ./mongodb-dump/weekly-eats/recipes.bson
```

### Verify data integrity

After importing, check your data:

```bash
# Connect to MongoDB
mongosh weekly-eats

# Check collections
show collections

# Count documents in each collection
db.mealPlans.countDocuments()
db.recipes.countDocuments()
db.foodItems.countDocuments()
db.pantry.countDocuments()
db.users.countDocuments()

# Sample a few documents
db.mealPlans.findOne()
db.recipes.findOne()
```

## What Gets Migrated

The migration includes all collections in your database:
- `mealPlans` - Your meal plans
- `mealPlanTemplates` - Meal plan templates
- `recipes` - Recipe data
- `foodItems` - Food item definitions
- `pantry` - Pantry inventory
- `users` - User accounts (if using authentication)
- `accounts`, `sessions` - NextAuth data (if using authentication)

**Note:** Indexes are NOT included in the dump. You must run `npm run setup-db` after importing to recreate them.

## Security Considerations

- The dump contains all your data, including user information
- Keep the dump file secure during transfer
- Delete the dump file after successful migration if it contains sensitive data
- If using authentication, user passwords are hashed, but email addresses and other data are in plain text

## File Size Considerations

- Small databases (< 100MB): Quick transfer, can use any method
- Medium databases (100MB - 1GB): Consider compression (tar.gz), may take a few minutes
- Large databases (> 1GB): May take significant time, consider using `rsync` for network transfer

