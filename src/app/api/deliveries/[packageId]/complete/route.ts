import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'DRIVER') {
      return NextResponse.json({ error: 'Only drivers can complete deliveries' }, { status: 403 });
    }

    const { packageId } = await params;

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        delivery: true,
        items: true,
      }
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Verify this package is assigned to the current driver
    if (pkg.driverId !== session.user.id) {
      return NextResponse.json({ error: 'This package is not assigned to you' }, { status: 403 });
    }

    // Verify package is in IN_TRANSIT status
    if (pkg.status !== 'IN_TRANSIT') {
      return NextResponse.json({ error: 'Package is not in IN_TRANSIT status' }, { status: 400 });
    }

    if (pkg.items.length > 1 && pkg.items.some((item) => item.deliveryStatus !== 'DELIVERED' && item.deliveryStatus !== 'FAILED')) {
      return NextResponse.json(
        { error: 'Complete the individual delivery stops before closing a multi-stop package' },
        { status: 400 }
      );
    }

    const hasFailedStops = pkg.items.some((item) => item.deliveryStatus === 'FAILED');

    const completedAt = new Date();
    const actualTime = pkg.delivery?.startedAt
      ? Math.max(0, Math.round((completedAt.getTime() - pkg.delivery.startedAt.getTime()) / 60000))
      : null;

    const [updatedPackage, delivery] = await prisma.$transaction([
      prisma.package.update({
        where: { id: packageId },
        data: {
          status: hasFailedStops ? 'FAILED' : 'DELIVERED',
          deliveredAt: completedAt,
          failureReason: hasFailedStops ? 'One or more delivery stops failed.' : null,
        },
        include: {
          delivery: true,
          items: { include: { product: true } },
        },
      }),
      prisma.delivery.upsert({
        where: { packageId },
        update: {
          status: hasFailedStops ? 'FAILED' : 'COMPLETED',
          completedAt,
          actualTime,
        },
        create: {
          packageId,
          status: hasFailedStops ? 'FAILED' : 'COMPLETED',
          completedAt,
          actualTime,
        },
      }),
      prisma.driverProfile.updateMany({
        where: { userId: session.user.id },
        data: { isAvailable: true, totalDeliveries: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      message: 'Delivery completed successfully',
      package: updatedPackage,
      delivery,
    });

  } catch (error) {
    console.error('Error completing delivery:', error);
    return NextResponse.json(
      { error: 'Failed to complete delivery' },
      { status: 500 }
    );
  }
}
