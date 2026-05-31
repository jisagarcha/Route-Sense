# RouteSense Startup Guide

This guide starts the full RouteSense project locally: PostgreSQL, Prisma database setup, demo users, seed data, and the Next.js development server.

## Quick Setup

For the existing local macOS/Homebrew setup:

```bash
cd /Users/sagarsandha/Downloads/RouteSense-main
brew services start postgresql@17
npm install
npx prisma generate
npx prisma db push
node seed-demo-users.js
npx prisma db seed
node seed-roads.js
npm run dev
```

Then open:

```text
http://localhost:3000
```

If the database does not exist yet:

```bash
createdb delivery_optimizer
```

## 1. Requirements

- Node.js 20+ or 22
- npm
- PostgreSQL running on port `5432`
- Optional: Docker, if you prefer Docker Compose

Check versions:

```bash
node --version
npm --version
psql --version
```

## 2. Install Dependencies

From the project folder:

```bash
cd /Users/sagarsandha/Downloads/RouteSense-main
npm install
```

## 3. Start PostgreSQL

### macOS Homebrew

Use the PostgreSQL version installed on your machine. For example:

```bash
brew services start postgresql@17
```

Check that PostgreSQL is listening:

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

### Create Local Database

The current local `.env` uses:

```env
DATABASE_URL="postgresql://sagarsandha@localhost:5432/delivery_optimizer?schema=public"
```

Create that database if it does not exist:

```bash
createdb delivery_optimizer
```

If your PostgreSQL username/database is different, update `.env` accordingly.

## 4. Environment File

If `.env` is missing, create it from the example:

```bash
cp .env.example .env
```

For local development, make sure `.env` has:

```env
DATABASE_URL="postgresql://sagarsandha@localhost:5432/delivery_optimizer?schema=public"
NEXTAUTH_SECRET="supersecret_nextauth_string_1234567890_route_sense"
NEXTAUTH_URL="http://localhost:3000"
OSRM_BASE_URL="https://router.project-osrm.org"
NOMINATIM_BASE_URL="https://nominatim.openstreetmap.org"
NOMINATIM_USER_AGENT="RouteSense/1.0"
```

## 5. Initialize Database

Run Prisma and seed scripts:

```bash
npx prisma generate
npx prisma db push
node seed-demo-users.js
npx prisma db seed
node seed-roads.js
```

Or use the setup script:

```bash
./setup-db.sh
node seed-roads.js
```

## 6. Start the App

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 7. Demo Accounts

Use these demo logins:

```text
Admin:      admin@admin.com / anihortes
Analyst:    analyst@routesense.com / analyst
Dispatcher: dispatcher@gmail.com / dispatcher
Driver:     rajesh.driver@delivery.com / driverdai
```

Role pages:

```text
Admin map:          http://localhost:3000/admin/map
Analyst history:    http://localhost:3000/admin/history
Analyst patterns:   http://localhost:3000/admin/patterns
Dispatcher routes:  http://localhost:3000/dispatcher/routes/new
Driver dashboard:   http://localhost:3000/driver
```

## 8. Docker Alternative

If Docker is installed:

```bash
cp .env.example .env
docker compose up --build
```

Docker Compose starts PostgreSQL and the app, pushes the Prisma schema, and seeds demo data.

## 9. Common Commands

```bash
npm run dev
npm run build
npx prisma generate
npx prisma db push
npx prisma studio
node seed-demo-users.js
npx prisma db seed
node seed-roads.js
```

## 10. Troubleshooting

### Database Cannot Connect

Check PostgreSQL:

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
psql -h localhost -d delivery_optimizer -c "SELECT 1;"
```

Start PostgreSQL:

```bash
brew services start postgresql@17
```

### Missing Tables

```bash
npx prisma db push
```

### Demo Login Fails

```bash
node seed-demo-users.js
```

### Missing Products, Warehouses, Locations, Roads

```bash
npx prisma db seed
node seed-roads.js
```

### Port 3000 Already Used

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Start on another port:

```bash
npm run dev -- -p 3001
```

### Clean Rebuild

```bash
rm -rf .next
npm run build
```

## 11. Recommended Startup Order

Use this order every time after restarting your machine:

```bash
cd /Users/sagarsandha/Downloads/RouteSense-main
brew services start postgresql@17
npm run dev
```

If database data is missing:

```bash
./setup-db.sh
node seed-roads.js
npm run dev
```
