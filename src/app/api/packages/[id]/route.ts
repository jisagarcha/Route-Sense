import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { optimizeRoute, type Stop } from '@/lib/routeEngine';

interface PackageItemForRouting {
  id: string;
  deliveryLat: number | null;
  deliveryLong: number | null;
  deliveryAddress: string | null;
}

interface PackageForRouting {
  id: string;
  packageName: string;
  routeId?: string | null;
  warehouseLat: number | null;
  warehouseLong: number | null;
  warehouseAddress?: string | null;
  deliveryLat: number | null;
  deliveryLong: number | null;
  deliveryLng?: number | null;
  deliveryAddress: string | null;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  timeWindowStart?: Date | null;
  timeWindowEnd?: Date | null;
  items: PackageItemForRouting[];
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: packageId } = await params;
    const body = await req.json();

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { items: true }
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Only dispatcher or admin can update
    if (session.user.role !== 'DISPATCHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only dispatchers can update packages' }, { status: 403 });
    }

    if (session.user.role === 'DISPATCHER' && pkg.dispatcherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (body.driverId) {
      // Only allow assigning PENDING packages
      if (pkg.status !== 'PENDING') {
        return NextResponse.json({ error: 'Package is not in PENDING status' }, { status: 400 });
      }

      // Verify driver exists and has profile
      const driver = await prisma.user.findUnique({
        where: { id: body.driverId },
        include: { driverProfile: true }
      });

      if (!driver || driver.role !== 'DRIVER') {
        return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
      }

      if (!driver.driverProfile) {
        return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 });
      }

      let routeId = pkg.routeId;
      let routeWarning: string | null = null;

      if (!routeId) {
        try {
          const autoRoute = await calculateAutoRouteForPackage(pkg, body.driverId);
          routeId = autoRoute?.id || null;
          routeWarning = autoRoute?.warning || null;
        } catch (routeError) {
          console.warn('Auto route calculation failed during assignment:', routeError);
          routeWarning = 'Driver assigned, but route could not be auto-calculated yet.';
        }
      }

      const [updatedPackage] = await prisma.$transaction([
        prisma.package.update({
          where: { id: packageId },
          data: {
            driverId: body.driverId,
            status: 'ASSIGNED',
            ...(routeId && { routeId }),
          },
          include: {
            dispatcher: true,
            driver: true,
            route: true,
            delivery: true,
            items: {
              include: { product: true },
              orderBy: { sequence: 'asc' },
            }
          }
        }),
        prisma.delivery.upsert({
          where: { packageId },
          update: { status: 'PENDING', startedAt: null, completedAt: null, actualTime: null },
          create: {
            packageId,
            status: 'PENDING'
          }
        }),
        prisma.driverProfile.updateMany({
          where: { userId: body.driverId },
          data: { isAvailable: false },
        }),
      ]);

      if (routeId) {
        await prisma.route.update({
          where: { id: routeId },
          data: { driverId: body.driverId },
        });
      }

      return NextResponse.json({
        message: routeWarning
          ? `Driver assigned successfully. ${routeWarning}`
          : 'Driver assigned successfully',
        routeWarning,
        package: updatedPackage
      });
    }

    if (body.warehouseLat !== undefined || body.warehouseLong !== undefined || body.warehouseLng !== undefined || body.items) {
      if (pkg.status !== 'PENDING') {
        return NextResponse.json({ error: 'Only pending packages can be optimized' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {};

      if (body.warehouseLat !== undefined) updateData.warehouseLat = body.warehouseLat;
      if (body.warehouseLong !== undefined || body.warehouseLng !== undefined) {
        updateData.warehouseLong = body.warehouseLong ?? body.warehouseLng;
      }
      if (body.warehouseAddress !== undefined) updateData.warehouseAddress = body.warehouseAddress;
      if (body.deliveryLat !== undefined) updateData.deliveryLat = body.deliveryLat;
      if (body.deliveryLong !== undefined || body.deliveryLng !== undefined) {
        const nextDeliveryLng = body.deliveryLong ?? body.deliveryLng;
        updateData.deliveryLong = nextDeliveryLng;
        updateData.deliveryLng = nextDeliveryLng;
      }
      if (body.deliveryAddress !== undefined) updateData.deliveryAddress = body.deliveryAddress;
      if (body.totalDistance !== undefined) updateData.totalDistance = body.totalDistance;
      if (body.estimatedDuration !== undefined) updateData.estimatedDuration = body.estimatedDuration;
      if (body.routeAlgorithm !== undefined) updateData.routeAlgorithm = body.routeAlgorithm;

      const itemIds = new Set(pkg.items.map((item) => item.id));
      const itemUpdates = [];
      if (body.items && Array.isArray(body.items)) {
        for (const item of body.items) {
          if (!itemIds.has(item.id)) {
            return NextResponse.json({ error: 'Invalid package item update' }, { status: 400 });
          }

          const updateItemData: Record<string, unknown> = {};
          
          if (item.deliveryLat !== undefined) updateItemData.deliveryLat = item.deliveryLat;
          if (item.deliveryLong !== undefined) updateItemData.deliveryLong = item.deliveryLong;
          if (item.deliveryAddress !== undefined) updateItemData.deliveryAddress = item.deliveryAddress;
          if (item.sequence !== undefined) updateItemData.sequence = item.sequence;
          
          itemUpdates.push(prisma.packageItem.update({
            where: { id: item.id },
            data: updateItemData
          }));
        }
      }

      await prisma.$transaction([
        prisma.package.update({
          where: { id: packageId },
          data: updateData,
        }),
        ...itemUpdates,
      ]);

      const updatedPackage = await prisma.package.findUnique({
        where: { id: packageId },
        include: {
          dispatcher: { select: { id: true, name: true, email: true } },
          driver: { select: { id: true, name: true, email: true } },
          delivery: true,
          items: {
            include: { product: true },
            orderBy: { sequence: 'asc' },
          },
        },
      });

      return NextResponse.json({
        message: 'Package route optimized successfully',
        package: updatedPackage
      });
    }

    const detailUpdateData = buildPackageDetailUpdate(body);

    if (Object.keys(detailUpdateData).length > 0) {
      const updatedPackage = await prisma.package.update({
        where: { id: packageId },
        data: detailUpdateData,
        include: {
          dispatcher: { select: { id: true, name: true, email: true } },
          driver: { select: { id: true, name: true, email: true } },
          route: true,
          delivery: true,
          items: {
            include: { product: true },
            orderBy: { sequence: 'asc' },
          },
        },
      });

      return NextResponse.json({
        message: 'Package updated successfully',
        package: updatedPackage,
      });
    }

    return NextResponse.json({ error: 'No valid update data provided' }, { status: 400 });

  } catch (error) {
    console.error('Error updating package:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update package';
    return NextResponse.json(
      { error: errorMessage, details: error },
      { status: 500 }
    );
  }
}

function buildPackageDetailUpdate(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const stringFields = [
    'packageName',
    'recipientName',
    'recipientPhone',
    'deliveryAddress',
    'warehouseAddress',
    'notes',
    'failureReason',
  ];

  for (const field of stringFields) {
    if (body[field] !== undefined) {
      data[field] = typeof body[field] === 'string' && body[field] !== ''
        ? body[field]
        : null;
    }
  }

  const numericFields = ['totalWeight', 'totalVolume', 'warehouseLat', 'warehouseLong', 'deliveryLat'];
  for (const field of numericFields) {
    if (body[field] !== undefined) {
      const value = Number(body[field]);
      if (Number.isFinite(value)) {
        data[field] = value;
      }
    }
  }

  if (body.deliveryLong !== undefined || body.deliveryLng !== undefined) {
    const value = Number(body.deliveryLong ?? body.deliveryLng);
    if (Number.isFinite(value)) {
      data.deliveryLong = value;
      data.deliveryLng = value;
    }
  }

  if (body.warehouseLng !== undefined) {
    const value = Number(body.warehouseLng);
    if (Number.isFinite(value)) {
      data.warehouseLong = value;
    }
  }

  if (body.priority === 'HIGH' || body.priority === 'NORMAL' || body.priority === 'LOW') {
    data.priority = body.priority;
  }

  if (body.timeWindowStart !== undefined) {
    data.timeWindowStart = parseNullableDate(body.timeWindowStart);
  }

  if (body.timeWindowEnd !== undefined) {
    data.timeWindowEnd = parseNullableDate(body.timeWindowEnd);
  }

  return data;
}

function parseNullableDate(value: unknown) {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function calculateAutoRouteForPackage(pkg: PackageForRouting, driverId: string) {
  const stop = getPrimaryStop(pkg);
  if (!stop) {
    return {
      id: null,
      warning: 'No delivery coordinates are available for auto-routing.',
    };
  }

  const depot = {
    lat: Number.isFinite(Number(pkg.warehouseLat)) ? Number(pkg.warehouseLat) : 27.7172,
    lng: Number.isFinite(Number(pkg.warehouseLong)) ? Number(pkg.warehouseLong) : 85.3120,
  };

  const result = await optimizeRoute(depot, [stop]);
  const warehouse = await findOrCreateWarehouse(
    depot.lat,
    depot.lng,
    pkg.warehouseAddress || 'Default RouteSense Warehouse'
  );

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

  return {
    id: route.id,
    warning: result.warnings.length ? result.warnings.join(' ') : null,
  };
}

function getPrimaryStop(pkg: PackageForRouting): Stop | null {
  const packageLng = pkg.deliveryLong ?? pkg.deliveryLng ?? null;
  if (Number.isFinite(Number(pkg.deliveryLat)) && Number.isFinite(Number(packageLng))) {
    return {
      id: pkg.id,
      lat: Number(pkg.deliveryLat),
      lng: Number(packageLng),
      priority: pkg.priority || 'NORMAL',
      timeWindowStart: pkg.timeWindowStart || undefined,
      timeWindowEnd: pkg.timeWindowEnd || undefined,
      address: pkg.deliveryAddress || pkg.packageName,
    };
  }

  const firstLocatedItem = pkg.items.find((item) =>
    Number.isFinite(Number(item.deliveryLat)) && Number.isFinite(Number(item.deliveryLong))
  );

  if (!firstLocatedItem) {
    return null;
  }

  return {
    id: pkg.id,
    lat: Number(firstLocatedItem.deliveryLat),
    lng: Number(firstLocatedItem.deliveryLong),
    priority: pkg.priority || 'NORMAL',
    timeWindowStart: pkg.timeWindowStart || undefined,
    timeWindowEnd: pkg.timeWindowEnd || undefined,
    address: firstLocatedItem.deliveryAddress || pkg.deliveryAddress || pkg.packageName,
  };
}

async function findOrCreateWarehouse(lat: number, lng: number, address: string) {
  const existing = await prisma.warehouse.findFirst({
    where: {
      name: 'Default RouteSense Warehouse',
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.warehouse.create({
    data: {
      name: 'Default RouteSense Warehouse',
      address,
      lat,
      lng,
    },
  });
}

// Get single package by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: packageId } = await params;

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        dispatcher: { select: { id: true, name: true, email: true } },
        driver: { select: { id: true, name: true, email: true } },
        route: true,
        items: {
          include: {
            product: true
          }
        },
        delivery: {
          include: {
            checkpoints: true
          }
        }
      }
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Check permissions
    if (
      session.user.role !== 'ADMIN' &&
      pkg.dispatcherId !== session.user.id &&
      pkg.driverId !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ package: pkg });

  } catch (error) {
    console.error('Error fetching package:', error);
    return NextResponse.json(
      { error: 'Failed to fetch package' },
      { status: 500 }
    );
  }
}

// Delete package (dispatcher only, pending packages only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: packageId } = await params;

    const pkg = await prisma.package.findUnique({
      where: { id: packageId }
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Only dispatcher who created it or admin can delete
    if (
      session.user.role !== 'ADMIN' &&
      (session.user.role !== 'DISPATCHER' || pkg.dispatcherId !== session.user.id)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow deleting PENDING packages
    if (pkg.status !== 'PENDING') {
      return NextResponse.json({ error: 'Can only delete pending packages' }, { status: 400 });
    }

    // Delete package items first (due to foreign key constraint)
    await prisma.packageItem.deleteMany({
      where: { packageId }
    });

    // Delete package
    await prisma.package.delete({
      where: { id: packageId }
    });

    return NextResponse.json({ message: 'Package deleted successfully' });

  } catch (error) {
    console.error('Error deleting package:', error);
    return NextResponse.json(
      { error: 'Failed to delete package' },
      { status: 500 }
    );
  }
}
