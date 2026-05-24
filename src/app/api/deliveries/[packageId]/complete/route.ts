import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { packageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'DRIVER') {
      return NextResponse.json({ error: 'Only drivers can complete deliveries' }, { status: 403 });
    }

    const packageId = params.packageId;

    // Get the package and its delivery
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

    // Verify package is in IN_TRANSIT status
    if (pkg.status !== 'IN_TRANSIT') {
      return NextResponse.json({ error: 'Package is not in IN_TRANSIT status' }, { status: 400 });
    }

    // Update package status to DELIVERED
    await prisma.package.update({
      where: { id: packageId },
      data: { status: 'DELIVERED' }
    });

    // Update delivery status and set completedAt
    if (pkg.delivery) {
      await prisma.delivery.update({
        where: { id: pkg.delivery.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
    }

    return NextResponse.json({
      message: 'Delivery completed successfully'
    });

  } catch (error) {
    console.error('Error completing delivery:', error);
    return NextResponse.json(
      { error: 'Failed to complete delivery' },
      { status: 500 }
    );
  }
}
