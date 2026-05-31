import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type DriverRoutePackage = Prisma.PackageGetPayload<{
  include: {
    items: { include: { product: true } };
  };
}>;

// GET /api/route-history - Get route requests and driver delivery history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'ANALYST', 'DRIVER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const driverId = searchParams.get('driverId');

    const limit = limitParam ? parseInt(limitParam) : 50;
    const offset = offsetParam ? parseInt(offsetParam) : 0;

    const routeRequests = session.user.role === 'DRIVER' ? [] : await prisma.routeRequest.findMany({
      include: {
        sourceLocation: true,
        targetLocation: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = session.user.role === 'DRIVER' ? 0 : await prisma.routeRequest.count();
    const driverWhere: Prisma.PackageWhereInput = {
      driverId: session.user.role === 'DRIVER' ? session.user.id : driverId || undefined,
      status: {
        in: [
          'ASSIGNED',
          'COLLECTED_FROM_WAREHOUSE',
          'IN_TRANSIT',
          'DELIVERED',
          'FAILED',
        ],
      },
    };

    const [driverRoutes, driverRouteTotal, drivers] = await prisma.$transaction([
      prisma.package.findMany({
        where: driverWhere,
        include: {
          driver: { select: { id: true, name: true, email: true } },
          dispatcher: { select: { id: true, name: true, email: true } },
          delivery: true,
          route: true,
          items: {
            include: { product: true },
            orderBy: { sequence: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.package.count({ where: driverWhere }),
      prisma.user.findMany({
        where: {
          role: 'DRIVER',
          ...(session.user.role === 'DRIVER' ? { id: session.user.id } : {}),
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const formattedDriverRoutes = driverRoutes.map((pkg) => {
      const completedAt = pkg.deliveredAt || pkg.delivery?.completedAt || null;
      const startedAt = pkg.delivery?.startedAt || pkg.collectedAt || null;
      const stops = getPackageStops(pkg);

      return {
        id: pkg.id,
        packageName: pkg.packageName,
        status: pkg.status,
        priority: pkg.priority,
        driver: pkg.driver,
        dispatcher: pkg.dispatcher,
        routeId: pkg.routeId,
        routeStatus: pkg.route?.status || null,
        polyline: parsePolyline(pkg.route?.polylineJson),
        warehouseAddress: pkg.warehouseAddress,
        warehouseLat: pkg.warehouseLat,
        warehouseLong: pkg.warehouseLong,
        deliveryAddress: pkg.deliveryAddress,
        stops,
        stopCount: stops.length,
        totalDistanceKm: pkg.totalDistance ?? pkg.route?.totalDistanceKm ?? null,
        estimatedDurationMin: pkg.estimatedDuration ?? pkg.route?.totalDurationMin ?? null,
        actualDurationMin: pkg.delivery?.actualTime ?? calculateDurationMinutes(startedAt, completedAt),
        startedAt,
        completedAt,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
        failureReason: pkg.failureReason,
      };
    });

    return NextResponse.json(
      {
        routeRequests,
        driverRoutes: formattedDriverRoutes,
        drivers,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        driverRoutePagination: {
          total: driverRouteTotal,
          limit,
          offset,
          hasMore: offset + limit < driverRouteTotal,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching route history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch route history' },
      { status: 500 }
    );
  }
}

function parsePolyline(polylineJson?: string | null) {
  if (!polylineJson) return [];
  try {
    const parsed = JSON.parse(polylineJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((point): point is [number, number] =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(Number(point[0])) &&
      Number.isFinite(Number(point[1]))
    );
  } catch {
    return [];
  }
}

function getPackageStops(pkg: DriverRoutePackage) {
  const itemStops = pkg.items
    .map((item) => ({
      id: item.id,
      address: item.deliveryAddress || pkg.deliveryAddress || pkg.packageName,
      lat: item.deliveryLat,
      lng: item.deliveryLong,
      recipientName: item.recipientName,
      productName: item.product?.name || null,
      status: item.deliveryStatus,
      sequence: item.sequence,
    }))
    .filter((stop) => Number.isFinite(Number(stop.lat)) && Number.isFinite(Number(stop.lng)));

  if (itemStops.length > 0) {
    const uniqueStops = new Map<string, (typeof itemStops)[number]>();
    for (const stop of itemStops) {
      const key = `${stop.lat}:${stop.lng}:${stop.address}`;
      if (!uniqueStops.has(key)) uniqueStops.set(key, stop);
    }
    return Array.from(uniqueStops.values()).sort(
      (a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)
    );
  }

  if (Number.isFinite(Number(pkg.deliveryLat)) && Number.isFinite(Number(pkg.deliveryLong))) {
    return [
      {
        id: pkg.id,
        address: pkg.deliveryAddress || pkg.packageName,
        lat: pkg.deliveryLat,
        lng: pkg.deliveryLong,
        recipientName: pkg.recipientName,
        productName: null,
        status: pkg.status,
        sequence: 1,
      },
    ];
  }

  return [];
}

function calculateDurationMinutes(startedAt?: Date | null, completedAt?: Date | null) {
  if (!startedAt || !completedAt) return null;
  return Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000));
}
