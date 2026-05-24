import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Get the package
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

    // Handle driver assignment
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

      const [updatedPackage] = await prisma.$transaction([
        prisma.package.update({
          where: { id: packageId },
          data: {
            driverId: body.driverId,
            status: 'ASSIGNED'
          },
          include: {
            dispatcher: true,
            driver: true,
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

      return NextResponse.json({
        message: 'Driver assigned successfully',
        package: updatedPackage
      });
    }

    // Handle route optimization update
    if (body.warehouseLat !== undefined || body.items) {
      if (pkg.status !== 'PENDING') {
        return NextResponse.json({ error: 'Only pending packages can be optimized' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {};

      if (body.warehouseLat !== undefined) updateData.warehouseLat = body.warehouseLat;
      if (body.warehouseLong !== undefined) updateData.warehouseLong = body.warehouseLong;
      if (body.deliveryLat !== undefined) updateData.deliveryLat = body.deliveryLat;
      if (body.deliveryLong !== undefined) updateData.deliveryLong = body.deliveryLong;
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
