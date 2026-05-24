# 🚀 Quick Setup Guide

Follow these steps to get the Delivery Route & Cost Optimizer running:

## Step 1: Environment Setup

```bash
# Switch to Node.js 22
nvm use 22

# Verify Node version
node --version  # Should show v22.x.x
```

## Step 2: Install Dependencies

```bash
# Install all packages
yarn install
```

## Step 3: Database Configuration

1. **Start PostgreSQL** (if not already running)
   ```bash
   # macOS with Homebrew
   brew services start postgresql@14
   
   # Or use Docker
   docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
   ```

2. **Create Database**
   ```bash
   # Connect to PostgreSQL
   psql postgres
   
   # Create database
   CREATE DATABASE delivery_optimizer;
   
   # Exit
   \q
   ```

3. **Update .env file**
   
   Make sure your `.env` file has the correct database URL:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/delivery_optimizer?schema=public"
   ```
   
   Replace `postgres:password` with your PostgreSQL username and password.

## Step 4: Initialize Database

```bash
# Generate Prisma Client
yarn prisma generate

# Push schema to database
yarn prisma db push

# (Optional) Open Prisma Studio to view database
yarn prisma studio
```

## Step 5: Start Development Server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 6: Initial Data Setup

### Add Locations
1. Go to [http://localhost:3000/admin/locations](http://localhost:3000/admin/locations)
2. Click "Add New Location"
3. Add these sample locations:
   - **Warehouse A** (Central Hub)
   - **Store B** (Retail Location)
   - **Customer C** (Delivery Point)
   - **Customer D** (Delivery Point)
   - **Hub E** (Distribution Center)

### Add Roads
1. Go to [http://localhost:3000/admin/roads](http://localhost:3000/admin/roads)
2. Click "Add New Road"
3. Create these connections:
   - Warehouse A → Store B: 5 km (Two-way)
   - Store B → Customer C: 3 km (Two-way)
   - Warehouse A → Hub E: 8 km (Two-way)
   - Hub E → Customer C: 4 km (Two-way)
   - Customer C → Customer D: 2 km (Two-way)
   - Store B → Customer D: 7 km (Two-way)

### Test Route Computation
1. Go to [http://localhost:3000](http://localhost:3000)
2. Select Source: **Warehouse A**
3. Select Destination: **Customer D**
4. Click "Find Best Route"
5. View the optimal path and distance

### Analyze Patterns
1. Compute several different routes first
2. Go to [http://localhost:3000/admin/patterns](http://localhost:3000/admin/patterns)
3. Set Min Support: 0.3
4. Click "Analyze Patterns"
5. View frequent location combinations

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
pg_isready

# Test connection
psql -U postgres -d delivery_optimizer -c "SELECT 1;"
```

### Prisma Issues
```bash
# Reset database (WARNING: Deletes all data)
yarn prisma db push --force-reset

# Regenerate Prisma Client
yarn prisma generate
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 yarn dev
```

### TypeScript Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules yarn.lock
yarn install
```

## Verification Checklist

- [ ] Node.js v22 installed (`node --version`)
- [ ] PostgreSQL running
- [ ] Database `delivery_optimizer` created
- [ ] `.env` file configured
- [ ] Dependencies installed (`yarn install`)
- [ ] Prisma generated (`yarn prisma generate`)
- [ ] Database migrated (`yarn prisma db push`)
- [ ] Dev server running (`yarn dev`)
- [ ] Can access http://localhost:3000
- [ ] Locations added
- [ ] Roads created
- [ ] Route computed successfully

## Next Steps

1. **Explore the UI**: Navigate through all pages
2. **Test APIs**: Use the browser DevTools Network tab
3. **Add More Data**: Create a realistic road network
4. **Run Analytics**: Use the patterns page after adding routes
5. **Review Code**: Check the algorithm implementations in `src/lib/`

## Demo Credentials

This project doesn't have authentication by default. All pages are accessible directly.

For production use, consider adding:
- User authentication (NextAuth.js)
- Role-based access control
- API rate limiting
- Input sanitization

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check the terminal where `yarn dev` is running
3. Verify database connection
4. Ensure all dependencies are installed
5. Try clearing Next.js cache and rebuilding

---

Happy coding! 🚀
