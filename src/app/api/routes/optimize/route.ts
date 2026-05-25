import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { optimizeRoute, type Stop } from '@/lib/routeEngine';

interface PackageForRoute {
  id: string;
  packageName: string;
  dispatcherId: string;
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'DISPATCHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const packageIds = Array.isArray(body.packageIds)
      ? body.packageIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    const warehouseId = typeof body.warehouseId === 'string' ? body.warehouseId : '';

    if (packageIds.length === 0 || !warehouseId) {
      return NextResponse.json(
        { error: 'packageIds and warehouseId are required' },
        { status: 400 }
      );
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    const packages = await prisma.package.findMany({
      where: {
        id: { in: packageIds },
        ...(session.user.role === 'DISPATCHER' ? { dispatcherId: session.user.id } : {}),
      },
      include: { items: true },
    });

    if (packages.length === 0) {
      return NextResponse.json({ error: 'No packages found' }, { status: 404 });
    }

    const skipped: Array<{ packageId: string; reason: string }> = [];
    const stops = packages
      .map((pkg) => toRouteStop(pkg as PackageForRoute, skipped))
      .filter((stop): stop is Stop => Boolean(stop));

    if (stops.length === 0) {
      return NextResponse.json(
        { error: 'No selected packages have delivery coordinates', skipped },
        { status: 400 }
      );
    }

    const dispatchTime = body.dispatchTime ? new Date(body.dispatchTime) : undefined;
    const result = await optimizeRoute(
      { lat: warehouse.lat, lng: warehouse.lng },
      stops,
      dispatchTime && !Number.isNaN(dispatchTime.getTime()) ? dispatchTime : undefined
    );

    const route = await prisma.route.create({
      data: {
        warehouseId: warehouse.id,
        orderedStopIds: result.orderedStops.map((stop) => stop.id),
        totalDistanceKm: result.totalDistanceKm,
        totalDurationMin: result.totalDurationMinutes,
        polylineJson: JSON.stringify(result.polyline),
        estimatedArrivals: Object.fromEntries(
          result.estimatedArrivals.map((eta) => [eta.stopId, eta.eta.toISOString()])
        ),
        isAutoCalculated: false,
        optimizedAt: new Date(),
        status: 'PENDING',
      },
    });

    await prisma.package.updateMany({
      where: { id: { in: result.orderedStops.map((stop) => stop.id) } },
      data: {
        routeId: route.id,
        totalDistance: result.totalDistanceKm,
        estimatedDuration: result.totalDurationMinutes,
        routeAlgorithm: 'OSRM priority nearest-neighbor 2-opt',
      },
    });

    return NextResponse.json({
      success: true,
      route,
      result,
      skipped,
    });
  } catch (error) {
    console.error('Route optimization error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to optimize route' },
      { status: 500 }
    );
  }
}

function toRouteStop(pkg: PackageForRoute, skipped: Array<{ packageId: string; reason: string }>): Stop | null {
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

  if (!item) {
    skipped.push({ packageId: pkg.id, reason: 'Missing delivery coordinates' });
    return null;
  }

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
