#!/bin/bash

echo "🚀 Setting up database..."

echo "Step 1: Generating Prisma Client..."
npx prisma generate

echo ""
echo "Step 2: Pushing schema to database..."
npx prisma db push

echo ""
echo "Step 3: Seeding database with sample data..."
npx prisma db seed

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Now run: npm run dev"
