import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'DISPATCHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER' },
      include: {
        driverProfile: true,
        driverLocations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            driverPackages: {
              where: {
                status: { in: ['ASSIGNED', 'COLLECTED_FROM_WAREHOUSE', 'IN_TRANSIT'] },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      drivers: drivers.map((driver) => ({
        id: driver.id,
        name: driver.name,
        email: driver.email,
        profile: driver.driverProfile,
        latestLocation: driver.driverLocations[0] || null,
        activePackages: driver._count.driverPackages,
      })),
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
  }
}
