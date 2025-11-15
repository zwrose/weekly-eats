# Development Environment Setup Guide

This guide will help you set up your development environment on a fresh Ubuntu machine.

## Prerequisites Completed ✅

- ✅ Git installed
- ✅ Node.js v24.11.1 installed (via nvm)
- ✅ npm v11.6.2 installed
- ✅ Project dependencies installed

## Remaining Setup Steps

### 1. Install MongoDB

Run these commands to install MongoDB Community Edition:

```bash
# Import MongoDB public GPG key
curl -fsSL https://pgp.mongodb.com/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Update package list
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod

# Enable MongoDB to start on boot
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Copy the template
cp .env.local.example .env.local
```

Then edit `.env.local` and fill in the required values:

- **MONGODB_URI**: For local development, use `mongodb://localhost:27017/weekly-eats`
- **NEXTAUTH_SECRET**: Generate a random secret (see below)
- **GOOGLE_CLIENT_ID**: Your Google OAuth client ID (get from Google Cloud Console)
- **GOOGLE_CLIENT_SECRET**: Your Google OAuth client secret

#### Generate NEXTAUTH_SECRET

Run this command to generate a secure random secret:

```bash
openssl rand -base64 32
```

Copy the output and use it as your `NEXTAUTH_SECRET` value.

### 3. Set Up Google OAuth (Optional for local dev)

If you need authentication, you'll need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy the Client ID and Client Secret to your `.env.local`

### 4. Initialize Database

Once MongoDB is running and `.env.local` is configured, run:

```bash
npm run setup-db
```

This will create the necessary database indexes.

### 5. Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Troubleshooting

### MongoDB Connection Issues

If you get connection errors:

1. Check MongoDB is running: `sudo systemctl status mongod`
2. Check MongoDB logs: `sudo journalctl -u mongod -n 50`
3. Verify connection string in `.env.local`

### Node.js/npm Not Found

If you get "command not found" errors after opening a new terminal:

```bash
# Add to your ~/.bashrc (should already be there from nvm installation)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Then reload
source ~/.bashrc
```

### Port Already in Use

If port 3000 is already in use:

```bash
# Find what's using the port
sudo lsof -i :3000

# Kill the process or use a different port
PORT=3001 npm run dev
```

## Useful Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run setup-db` - Initialize database indexes

## Next Steps

- Review the [TODO list](TODO.md) for planned features
- Check [testing documentation](testing.md) for test setup
- Review [authentication security](authentication-security.md) for auth setup details

