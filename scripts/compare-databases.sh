#!/bin/bash

# Compare two MongoDB databases to help decide which one to keep
# Usage: ./scripts/compare-databases.sh

set -e

DB1="weekly-eats"
DB2="weekly-eats-dev"

echo "🔍 Comparing MongoDB databases: $DB1 vs $DB2"
echo ""

# Check if MongoDB is running
if ! systemctl is-active --quiet mongod 2>/dev/null; then
    echo "❌ MongoDB is not running"
    echo "   Start it with: sudo systemctl start mongod"
    exit 1
fi

# Collections to check
COLLECTIONS=("mealPlans" "recipes" "foodItems" "pantry" "users" "mealPlanTemplates" "accounts" "sessions")

printf "%-25s %15s %15s\n" "Collection" "$DB1" "$DB2"
echo "────────────────────────────────────────────────────────────"

for collection in "${COLLECTIONS[@]}"; do
    count1=$(mongosh --quiet --eval "db.getSiblingDB('$DB1').getCollection('$collection').countDocuments()" 2>/dev/null || echo "0")
    count2=$(mongosh --quiet --eval "db.getSiblingDB('$DB2').getCollection('$collection').countDocuments()" 2>/dev/null || echo "0")
    printf "%-25s %15s %15s\n" "$collection" "$count1" "$count2"
done

echo ""
echo "📊 Summary:"
echo "   Your current .env.local points to: weekly-eats-dev"
echo ""
echo "💡 Recommendation:"
echo "   - If weekly-eats-dev has your data, keep using it"
echo "   - If weekly-eats has your data, update .env.local to use weekly-eats"
echo "   - You can merge them if both have important data"
echo ""
echo "📖 See docs/MONGODB_MIGRATION.md for merging instructions"

