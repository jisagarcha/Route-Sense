import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { optimizeRoute, type Stop } from '@/lib/routeEngine';

interface PackageForAutoRoute {
  id: string;
  packageName: string;
  driverId: string | null;
  deliveryLat: number | null;
  deliveryLong: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  timeWindowStart: Date | null;
  timeWindowEnd: Date | null;
  items: Array<{
    deliveryLat: number | null;
    deliveryLong: number | null;
    deliveryAddress: string | null;
  }>;
}

const DEFAULT_DEPOT = { lat: 27.7172, lng: 85.3120 };

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'DISPATCHER', 'DRIVER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const packageId = typeof body.packageId === 'string' ? body.packageId : '';

    if (!packageId) {
      return NextResponse.json({ error: 'packageId is required' }, { status: 400 });
    }

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { items: true },
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    if (session.user.role === 'DRIVER' && pkg.driverId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const depot = await getDepot(body, session.user.id);
    const geocodeWarning: string[] = [];
    const stop = await toAutoStop(pkg as PackageForAutoRoute, geocodeWarning);

    if (!stop) {
      return NextResponse.json(
        { error: 'Package needs delivery coordinates or a geocodable delivery address' },
        { status: 400 }
      );
    }

    const result = await optimizeRoute(depot, [stop]);
    const warehouse = await findOrCreateAutoWarehouse(depot.lat, depot.lng);
    const driverId = typeof body.driverId === 'string' ? body.driverId : pkg.driverId;

    const route = await prisma.route.create({
      data: {
        warehouseId: warehouse.id,
        driverId,
        orderedStopIds: result.orderedStops.map((orderedStop) => orderedStop.id),
        totalDistanceKm: result.totalDistanceKm,
        totalDurationMin: result.totalDurationMinutes,
        polylineJson: JSON.stringify(result.polyline),
        estimatedArrivals: Object.fromEntries(
          result.estimatedArrivals.map((eta) => [eta.stopId, eta.eta.toISOString()])
        ),
        isAutoCalculated: true,
        optimizedAt: new Date(),
        status: 'PENDING',
      },
    });

    await prisma.package.update({
      where: { id: pkg.id },
      data: {
        routeId: route.id,
        deliveryLat: stop.lat,
        deliveryLong: stop.lng,
        deliveryLng: stop.lng,
        deliveryAddress: stop.address,
        totalDistance: result.totalDistanceKm,
        estimatedDuration: result.totalDurationMinutes,
        routeAlgorithm: 'Auto OSRM priority nearest-neighbor 2-opt',
      },
    });

    return NextResponse.json({
      success: true,
      route,
      result: {
        ...result,
        warnings: [...geocodeWarning, ...result.warnings],
      },
    });
  } catch (error) {
    console.error('Auto route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-route package' },
      { status: 500 }
    );
  }
}

async function getDepot(body: Record<string, unknown>, driverId: string) {
  const bodyLat = Number(body.driverCurrentLat);
  const bodyLng = Number(body.driverCurrentLng);
  if (Number.isFinite(bodyLat) && Number.isFinite(bodyLng)) {
    return { lat: bodyLat, lng: bodyLng };
  }

  const latest = await prisma.driverLocation.findFirst({
    where: { driverId },
    orderBy: { recordedAt: 'desc' },
  });

  if (latest) {
    return { lat: latest.lat, lng: latest.lng };
  }

  return DEFAULT_DEPOT;
}

async function toAutoStop(pkg: PackageForAutoRoute, warnings: string[]): Promise<Stop | null> {
  const lng = pkg.deliveryLong ?? pkg.deliveryLng;
  if (Number.isFinite(Number(pkg.deliveryLat)) && Number.isFinite(Number(lng))) {
    return {
      id: pkg.id,
      lat: Number(pkg.deliveryLat),
      lng: Number(lng),
      priority: pkg.priority || 'NORMAL',
      timeWindowStart: pkg.timeWindowStart || undefined,
      timeWindowEnd: pkg.timeWindowEnd || undefined,
      address: pkg.deliveryAddress || pkg.packageName,
    };
  }

  const item = pkg.items.find((candidate) =>
    Number.isFinite(Number(candidate.deliveryLat)) && Number.isFinite(Number(candidate.deliveryLong))
  );
  if (item) {
    return {
      id: pkg.id,
      lat: Number(item.deliveryLat),
      lng: Number(item.deliveryLong),
      priority: pkg.priority || 'NORMAL',
      timeWindowStart: pkg.timeWindowStart || undefined,
      timeWindowEnd: pkg.timeWindowEnd || undefined,
      address: item.deliveryAddress || pkg.deliveryAddress || pkg.packageName,
    };
  }

  if (pkg.deliveryAddress) {
    const geocoded = await geocodeAddress(pkg.deliveryAddress);
    if (geocoded) {
      warnings.push('Delivery coordinates were missing; address was geocoded for auto-routing.');
      return {
        id: pkg.id,
        lat: geocoded.lat,
        lng: geocoded.lng,
        priority: pkg.priority || 'NORMAL',
        timeWindowStart: pkg.timeWindowStart || undefined,
        timeWindowEnd: pkg.timeWindowEnd || undefined,
        address: geocoded.address,
      };
    }
  }

  return null;
}

async function geocodeAddress(address: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const params = new URLSearchParams({
      q: address,
      format: 'jsonv2',
      limit: '1',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': process.env.NOMINATIM_USER_AGENT || 'RouteSense/1.0',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const data = await response.json();
    const match = Array.isArray(data) ? data[0] : null;
    const lat = Number(match?.lat);
    const lng = Number(match?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      address: match.display_name || address,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function findOrCreateAutoWarehouse(lat: number, lng: number) {
  const existing = await prisma.warehouse.findFirst({
    where: { name: 'Auto Route Origin' },
  });

  if (existing) return existing;

  return prisma.warehouse.create({
    data: {
      name: 'Auto Route Origin',
      address: 'Driver current position',
      lat,
      lng,
    },
  });
}
