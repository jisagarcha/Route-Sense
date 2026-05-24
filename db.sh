#!/bin/bash

# Database Management Script
# Quick commands for managing the Easy Delivery database

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null 2>&1

case "$1" in
  seed)
    echo "🌱 Seeding database..."
    npx prisma db seed
    ;;
  reset)
    echo "🔄 Resetting database..."
    npx prisma migrate reset --force
    ;;
  studio)
    echo "🎨 Opening Prisma Studio..."
    npx prisma studio
    ;;
  migrate)
    echo "📦 Running migrations..."
    npx prisma migrate deploy
    ;;
  generate)
    echo "⚙️  Generating Prisma client..."
    npx prisma generate
    ;;
  status)
    echo "📊 Database status..."
    npx prisma migrate status
    ;;
  *)
    echo "Easy Delivery - Database Manager"
    echo ""
    echo "Usage: ./db.sh [command]"
    echo ""
    echo "Commands:"
    echo "  seed      - Seed the database with initial data"
    echo "  reset     - Reset and reseed the database"
    echo "  studio    - Open Prisma Studio (GUI)"
    echo "  migrate   - Run pending migrations"
    echo "  generate  - Generate Prisma client"
    echo "  status    - Check migration status"
    echo ""
    ;;
esac
