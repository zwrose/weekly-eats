#!/bin/bash

# MongoDB Migration Script
# This script helps migrate MongoDB data from an old machine to a new one
#
# Usage:
#   On OLD machine: ./scripts/migrate-mongodb.sh export
#   Transfer the dump directory to new machine
#   On NEW machine: ./scripts/migrate-mongodb.sh import /path/to/dump

set -e

# Default database name
DB_NAME="${MONGODB_DB_NAME:-weekly-eats}"
DUMP_DIR="${MONGODB_DUMP_DIR:-./mongodb-dump}"

export_data() {
    # Try to detect database from .env.local if not set
    local export_db_name="$DB_NAME"
    if [ -f ".env.local" ]; then
        local env_db=$(grep "^MONGODB_URI=" .env.local | sed 's/.*\/\([^/]*\)$/\1/' | tr -d '\r')
        if [ -n "$env_db" ]; then
            export_db_name="$env_db"
            echo "ℹ️  Detected database from .env.local: $export_db_name"
        fi
    fi
    
    echo "📦 Exporting MongoDB data..."
    echo "   Database: $export_db_name"
    echo "   Output directory: $DUMP_DIR"
    echo ""
    
    # Create dump directory
    mkdir -p "$DUMP_DIR"
    
    # Export the database
    mongodump --db="$export_db_name" --out="$DUMP_DIR"
    
    # Create a compressed archive
    echo ""
    echo "📦 Creating compressed archive..."
    tar -czf "${DUMP_DIR}.tar.gz" -C "$(dirname "$DUMP_DIR")" "$(basename "$DUMP_DIR")"
    
    echo ""
    echo "✅ Export complete!"
    echo "   Archive created: ${DUMP_DIR}.tar.gz"
    echo "   Raw dump directory: $DUMP_DIR"
    echo ""
    echo "📤 Next steps:"
    echo "   1. Transfer ${DUMP_DIR}.tar.gz to your new machine"
    echo "   2. On the new machine, extract it and run:"
    echo "      ./scripts/migrate-mongodb.sh import /path/to/extracted/dump"
}

import_data() {
    local source_dump="$1"
    
    if [ -z "$source_dump" ]; then
        echo "❌ Error: Please provide the path to the extracted dump directory"
        echo ""
        echo "Usage:"
        echo "  ./scripts/migrate-mongodb.sh import /path/to/mongodb-dump"
        exit 1
    fi
    
    if [ ! -d "$source_dump" ]; then
        echo "❌ Error: Dump directory not found: $source_dump"
        exit 1
    fi
    
    # Detect source database name from dump directory
    local source_db_name=""
    for dir in "$source_dump"/*; do
        if [ -d "$dir" ] && [ -n "$(find "$dir" -name "*.bson" -o -name "*.metadata.json" | grep -v "\._")" ]; then
            source_db_name=$(basename "$dir")
            break
        fi
    done
    
    if [ -z "$source_db_name" ]; then
        echo "❌ Error: Could not detect database name in dump directory"
        echo "   Expected structure: $source_dump/<database-name>/"
        exit 1
    fi
    
    # Try to detect target database from .env.local if not set
    local target_db_name="$DB_NAME"
    if [ -f ".env.local" ]; then
        local env_db=$(grep "^MONGODB_URI=" .env.local | sed 's/.*\/\([^/]*\)$/\1/' | tr -d '\r')
        if [ -n "$env_db" ]; then
            target_db_name="$env_db"
            echo "ℹ️  Detected target database from .env.local: $target_db_name"
        fi
    fi
    
    echo "📥 Importing MongoDB data..."
    echo "   Source: $source_dump"
    echo "   Source database: $source_db_name"
    echo "   Target database: $target_db_name"
    echo ""
    
    # Clean up macOS metadata files (._* files)
    echo "🧹 Cleaning up macOS metadata files..."
    find "$source_dump" -name "._*" -type f -delete
    local cleaned_count=$(find "$source_dump" -name "._*" -type f 2>/dev/null | wc -l)
    if [ "$cleaned_count" -gt 0 ]; then
        echo "   Removed macOS metadata files"
    fi
    
    # Check if MongoDB is running
    if ! systemctl is-active --quiet mongod 2>/dev/null; then
        echo "⚠️  MongoDB service is not running"
        echo "   Starting MongoDB..."
        sudo systemctl start mongod || {
            echo "❌ Failed to start MongoDB. Please start it manually:"
            echo "   sudo systemctl start mongod"
            exit 1
        }
    fi
    
    # Import the database
    echo "📥 Restoring data..."
    if [ "$source_db_name" != "$target_db_name" ]; then
        echo "   Note: Importing from '$source_db_name' into '$target_db_name'"
        # When database names differ, restore directly to target database
        # mongorestore will import all collections from the source directory
        mongorestore --db="$target_db_name" --drop "$source_dump/$source_db_name"
    else
        mongorestore --db="$target_db_name" --drop "$source_dump/$source_db_name"
    fi
    
    echo ""
    echo "✅ Import complete!"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Run 'npm run setup-db' to recreate indexes"
    echo "   2. Verify your data: mongosh $target_db_name"
}

show_help() {
    echo "MongoDB Migration Script"
    echo ""
    echo "Usage:"
    echo "  ./scripts/migrate-mongodb.sh export          - Export data from old machine"
    echo "  ./scripts/migrate-mongodb.sh import <path>    - Import data to new machine"
    echo ""
    echo "Environment variables:"
    echo "  MONGODB_DB_NAME    Database name (default: weekly-eats)"
    echo "  MONGODB_DUMP_DIR   Dump directory (default: ./mongodb-dump)"
    echo ""
    echo "Examples:"
    echo "  # On old machine - export"
    echo "  ./scripts/migrate-mongodb.sh export"
    echo ""
    echo "  # Transfer mongodb-dump.tar.gz to new machine"
    echo ""
    echo "  # On new machine - extract and import"
    echo "  tar -xzf mongodb-dump.tar.gz"
    echo "  ./scripts/migrate-mongodb.sh import ./mongodb-dump"
}

case "${1:-}" in
    export)
        export_data
        ;;
    import)
        import_data "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ Unknown command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac

