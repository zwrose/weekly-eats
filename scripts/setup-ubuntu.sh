#!/bin/bash

# Ubuntu Setup Script for Weekly Eats
# This script helps set up MongoDB on Ubuntu

set -e

echo "🚀 Weekly Eats - Ubuntu Setup Script"
echo "====================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Please do not run this script as root/sudo"
   echo "   The script will prompt for sudo when needed"
   exit 1
fi

# Check if MongoDB is already installed
if command -v mongod &> /dev/null; then
    echo "✅ MongoDB appears to be installed"
    echo "   Checking if MongoDB service is running..."
    
    if systemctl is-active --quiet mongod; then
        echo "✅ MongoDB service is running"
    else
        echo "⚠️  MongoDB service is not running"
        echo "   Starting MongoDB service..."
        sudo systemctl start mongod
        sudo systemctl enable mongod
        echo "✅ MongoDB service started and enabled"
    fi
else
    echo "📦 Installing MongoDB Community Edition..."
    echo ""
    
    # Import MongoDB public GPG key
    echo "   Importing MongoDB GPG key..."
    curl -fsSL https://pgp.mongodb.com/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
    
    # Add MongoDB repository
    echo "   Adding MongoDB repository..."
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
    
    # Update package list
    echo "   Updating package list..."
    sudo apt-get update
    
    # Install MongoDB
    echo "   Installing MongoDB..."
    sudo apt-get install -y mongodb-org
    
    # Start MongoDB service
    echo "   Starting MongoDB service..."
    sudo systemctl start mongod
    sudo systemctl enable mongod
    
    echo "✅ MongoDB installed and started"
fi

# Verify MongoDB is running
echo ""
echo "🔍 Verifying MongoDB installation..."
if systemctl is-active --quiet mongod; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB is not running. Please check the service:"
    echo "   sudo systemctl status mongod"
    exit 1
fi

# Check for .env.local
echo ""
echo "🔍 Checking for .env.local file..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local file exists"
else
    echo "⚠️  .env.local file not found"
    echo ""
    echo "📝 Creating .env.local template..."
    cat > .env.local << 'EOF'
# MongoDB Connection
# For local development, use: mongodb://localhost:27017/weekly-eats
MONGODB_URI=mongodb://localhost:27017/weekly-eats

# Auth.js Configuration
# Generate a random secret with: openssl rand -base64 33
AUTH_SECRET=your-auth-secret-here

# Google OAuth (for authentication)
# Get these from Google Cloud Console: https://console.cloud.google.com/
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
EOF
    echo "✅ Created .env.local template"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env.local and fill in the required values:"
    echo "   1. Generate AUTH_SECRET: openssl rand -base64 33"
    echo "   2. Add your Google OAuth credentials (if needed)"
fi

# Setup database
echo ""
echo "🗄️  Setting up database indexes..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run setup-db

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Edit .env.local with your configuration"
echo "   2. Run 'npm run dev' to start the development server"
echo "   3. Visit http://localhost:3000"
echo ""
echo "📖 For more details, see docs/setup.md"

