## 🔍 Troubleshooting: No Products Showing

### The Issue
You're seeing "No products found matching your criteria" on the package creation page.

### Root Causes (Check These)

#### 1. **Database Not Seeded** ⚠️ MOST COMMON
The products table is empty because the seed script hasn't run yet.

**Solution:**
```bash
# Run this in your terminal:
./setup-db.sh

# Or manually:
npx prisma generate
npx prisma db push
npx prisma db seed
```

#### 2. **Not Logged In**
The products API requires authentication.

**Solution:**
- Make sure you're logged in
- Click one of the demo buttons: 👤 Admin, 📦 Dispatcher, or 🚚 Driver

#### 3. **API Error**
Check browser console (F12) for errors.

**What to look for:**
```
Products API response: { products: [...], categories: [...] }
ProductGrid received: { products: [...], productsLength: 20 }
```

If you see empty arrays `[]`, the database is empty.

---

### Quick Fix Steps

1. **Stop the dev server** (Ctrl+C)

2. **Run setup script:**
```bash
./setup-db.sh
```

3. **Start dev server:**
```bash
npm run dev
```

4. **Go to sign-in page:**
```
http://localhost:3000/auth/signin
```

5. **Click a demo button** (📦 Dispatcher recommended)

6. **Navigate to Packages → Create Package**

7. **You should now see 20 products!**

---

### Verify Database Has Data

Option 1: **Prisma Studio**
```bash
npx prisma studio
```
Open: http://localhost:5555
Check the `products` table - should have 20 rows

Option 2: **Check Console Logs**
When you open the create package page, check browser console:
```
Products API response: { products: Array(20), categories: Array(12) }
ProductGrid received: { products: Array(20), productsLength: 20 }
```

---

### Expected Products (After Seeding)

You should see these products:
- Samsung Galaxy S23 (Electronics)
- MacBook Pro M2 (Electronics)
- Pizza Margherita (Food)
- Medicine Package (Healthcare)
- Oxford Dictionary (Education)
- Nike Air Max (Fashion)
- Basmati Rice 25kg (Groceries)
- LED TV 55" (Electronics)
- PlayStation 5 (Electronics)
- Wooden Chair (Furniture)
- Important Documents (Documents)
- Lipstick Set (Beauty)
- Dog Food 10kg (Pet Supplies)
- Baby Diapers (Baby Products)
- Yoga Mat (Sports)
- Office Desk (Furniture)
- Winter Jacket (Fashion)
- Green Tea 500g (Groceries)
- Face Cream (Beauty)
- Washing Machine (Electronics)

---

### Still Not Working?

1. **Check .env file exists** with DATABASE_URL
2. **Database connection** - Can you connect to PostgreSQL?
3. **Restart everything:**
```bash
# Kill dev server
# Run setup script again
./setup-db.sh
# Start fresh
npm run dev
```

4. **Check terminal output** during seed - any errors?

5. **Manual seed check:**
```bash
npx prisma db seed
# Look for: "✅ Seeded 20 products"
```

---

### Debug Mode

Add these console logs temporarily:

**In package-creation-form.tsx (already added):**
```typescript
console.log('Products API response:', data);
```

**In product-grid.tsx (already added):**
```typescript
console.log('ProductGrid received:', { products, categories, productsLength: products.length });
```

Open browser console (F12) and check these logs when you visit the create package page.

---

### Success Criteria ✅

After following the steps above, you should see:
- ✅ 20 products in a grid
- ✅ Search box and filters working
- ✅ Can select products
- ✅ Console shows: `productsLength: 20`
- ✅ Categories dropdown has 12 categories

**If you see all these, it's working!** 🎉
