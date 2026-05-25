import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const allowedStatuses = new Set([
  'PENDING',
  'ASSIGNED',
  'COLLECTED_FROM_WAREHOUSE',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: packageId } = await params;
    const body = await req.json();
    const status = String(body.status || '').toUpperCase();

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: 'Invalid package status' }, { status: 400 });
    }

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        delivery: true,
        items: true,
      },
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    const isAssignedDriver = pkg.driverId === session.user.id;
    const canUpdate =
      session.user.role === 'ADMIN' ||
      session.user.role === 'DISPATCHER' ||
      (session.user.role === 'DRIVER' && isAssignedDriver);

    if (!canUpdate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.user.role === 'DRIVER' && !['COLLECTED_FROM_WAREHOUSE', 'IN_TRANSIT', 'DELIVERED', 'FAILED'].includes(status)) {
      return NextResponse.json({ error: 'Drivers cannot set this status' }, { status: 403 });
    }

    if (status === 'DELIVERED' && pkg.items.length > 1 && pkg.items.some((item) => item.deliveryStatus !== 'DELIVERED' && item.deliveryStatus !== 'FAILED')) {
      return NextResponse.json(
        { error: 'Resolve every delivery stop before marking the package delivered' },
        { status: 400 }
      );
    }

    if (status === 'DELIVERED' && pkg.items.some((item) => item.deliveryStatus === 'FAILED')) {
      return NextResponse.json(
        { error: 'This package has failed delivery stops; mark it as failed instead' },
        { status: 400 }
      );
    }

    const timestamp = parseTimestamp(body.timestamp);
    const data: Record<string, unknown> = { status };

    if (status === 'COLLECTED_FROM_WAREHOUSE') {
      data.collectedAt = timestamp;
    }

    if (status === 'DELIVERED') {
      data.deliveredAt = timestamp;
      data.failureReason = null;
    }

    if (status === 'FAILED') {
      data.failureReason = typeof body.failureReason === 'string' ? body.failureReason : 'Unspecified';
    }

    const [updatedPackage, delivery] = await prisma.$transaction([
      prisma.package.update({
        where: { id: packageId },
        data,
        include: {
          dispatcher: { select: { id: true, name: true, email: true } },
          driver: { select: { id: true, name: true, email: true } },
          route: true,
          delivery: true,
          items: { include: { product: true }, orderBy: { sequence: 'asc' } },
        },
      }),
      ...(status === 'IN_TRANSIT'
        ? [
            prisma.packageItem.updateMany({
              where: { packageId },
              data: {
                deliveryStatus: 'COLLECTED_FROM_WAREHOUSE',
                collectedAt: timestamp,
                failureReason: null,
              },
            }),
          ]
        : []),
      prisma.delivery.upsert({
        where: { packageId },
        update: buildDeliveryUpdate(status, timestamp),
        create: {
          packageId,
          ...buildDeliveryUpdate(status, timestamp),
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Package status updated successfully',
      package: updatedPackage,
      delivery,
    });
  } catch (error) {
    console.error('Error updating package status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update package status' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(req, context);
}

function parseTimestamp(value: unknown) {
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function buildDeliveryUpdate(status: string, timestamp: Date) {
  if (status === 'DELIVERED') {
    return {
      status: 'COMPLETED' as const,
      completedAt: timestamp,
    };
  }

  if (status === 'FAILED') {
    return {
      status: 'FAILED' as const,
      completedAt: timestamp,
    };
  }

  if (status === 'IN_TRANSIT') {
    return {
      status: 'IN_PROGRESS' as const,
      startedAt: timestamp,
    };
  }

  return {
    status: 'IN_PROGRESS' as const,
  };
}
