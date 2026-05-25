# RouteSense

RouteSense is a delivery route optimization app for drivers and dispatchers. The current product keeps the existing Next.js stack and adds the production route workflow on top of it: address geocoding, OSRM road routing, priority-aware TSP optimization, live driver tracking, delivery mode, history export, PWA install support, and admin/package tools.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn-style UI primitives
- Leaflet and OpenStreetMap tiles
- Nominatim geocoding
- OSRM table and route APIs, with Haversine fallback
- Prisma with PostgreSQL/PostGIS
- NextAuth credentials login with role-based access

## Quick Start With Docker

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000`.

Demo users are seeded on container startup:

- Admin: `admin@admin.com` / `anihortes`
- Dispatcher: `dispatcher@gmail.com` / `dispatcher`
- Driver: `rajesh.driver@delivery.com` / `driverdai`

## Local Development

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
node seed-demo-users.js
npx prisma db seed
node seed-roads.js
npm run dev
```

Set `DATABASE_URL` in `.env` to your local PostgreSQL database. The Docker compose file uses PostGIS, but the current Prisma schema only requires PostgreSQL-compatible fields.

## Main Workflow

1. Open `/`.
2. Set depot/current start coordinates or use GPS.
3. Add stops individually or paste one address per line.
4. Each stop supports recipient, notes, optional time window, and High/Normal/Low priority.
5. Click `Optimize`.
6. Start delivery mode and mark stops delivered one by one.
7. Export daily history as CSV when needed.

The planner stores the active route in `localStorage`, so the last route remains available if the browser goes offline. The service worker caches the app shell and map tiles that have already been viewed.

## API Endpoints

- `POST /api/geocode` - Nominatim geocoding for one or more addresses.
- `POST /api/delivery/optimize` - priority-aware nearest-neighbor + 2-opt route optimization using OSRM table data.
- `POST /api/route` - road-following geometry for a set of coordinates.
- `POST /api/admin/vrp` - admin-only greedy multi-driver stop assignment, then per-driver optimization.
- Existing package, delivery, road, location, history, auth, and analytics APIs remain under `/api`.

## Production Notes

- The public OSRM and Nominatim endpoints are suitable for demos only. For production volume, set `OSRM_BASE_URL` and `NOMINATIM_BASE_URL` to self-hosted or paid services.
- Replace `NEXTAUTH_SECRET` before deployment.
- Add rate limiting before exposing geocoding and routing APIs publicly.
- The current app uses Next.js API routes instead of the originally proposed FastAPI service because the prototype already had NextAuth, Prisma, package management, and admin pages in Next.js.

## Useful Commands

```bash
npm run lint
npm run build
npx prisma studio
```
