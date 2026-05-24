#!/bin/bash

# Easy Delivery - Development Startup Script
# This script ensures you're using the correct Node version and starts the dev server

echo "🚀 Starting Easy Delivery Development Server..."
echo ""

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Switch to Node 22
echo "📦 Switching to Node.js 22..."
nvm use 22

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📥 Installing dependencies..."
  yarn install
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
yarn prisma:generate

# Start the development server
echo "✨ Starting Next.js development server..."
echo ""
yarn dev
