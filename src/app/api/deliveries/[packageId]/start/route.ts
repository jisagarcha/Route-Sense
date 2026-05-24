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
      return NextResponse.json({ error: 'Only drivers can start deliveries' }, { status: 403 });
    }

    const { packageId } = await params;

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { delivery: true }
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Verify this package is assigned to the current driver
    if (pkg.driverId !== session.user.id) {
      return NextResponse.json({ error: 'This package is not assigned to you' }, { status: 403 });
    }

    // Verify package is in ASSIGNED status
    if (pkg.status !== 'ASSIGNED') {
      return NextResponse.json({ error: 'Package is not in ASSIGNED status' }, { status: 400 });
    }

    const startedAt = new Date();
    const [updatedPackage, delivery] = await prisma.$transaction([
      prisma.package.update({
        where: { id: packageId },
        data: { status: 'IN_TRANSIT' },
        include: {
          delivery: true,
          items: { include: { product: true } },
        },
      }),
      prisma.delivery.upsert({
        where: { packageId },
        update: {
          status: 'IN_PROGRESS',
          startedAt,
        },
        create: {
          packageId,
          status: 'IN_PROGRESS',
          startedAt,
        },
      }),
      prisma.driverProfile.updateMany({
        where: { userId: session.user.id },
        data: { isAvailable: false },
      }),
    ]);

    return NextResponse.json({
      message: 'Delivery started successfully',
      package: updatedPackage,
      delivery,
    });

  } catch (error) {
    console.error('Error starting delivery:', error);
    return NextResponse.json(
      { error: 'Failed to start delivery' },
      { status: 500 }
    );
  }
}
