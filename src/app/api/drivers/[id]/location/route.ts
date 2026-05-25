import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: driverId } = await params;
    const canRead = session.user.role === 'ADMIN' || session.user.id === driverId;
    if (!canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const location = await prisma.driverLocation.findFirst({
      where: { driverId },
      orderBy: { recordedAt: 'desc' },
    });

    return NextResponse.json({ location });
  } catch (error) {
    console.error('Error fetching driver location:', error);
    return NextResponse.json({ error: 'Failed to fetch driver location' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: driverId } = await params;
    const canWrite =
      session.user.role === 'ADMIN' ||
      (session.user.role === 'DRIVER' && session.user.id === driverId);

    if (!canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const timestamp = typeof body.timestamp === 'string' ? new Date(body.timestamp) : new Date();

    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Valid lat and lng are required' }, { status: 400 });
    }

    const location = await prisma.driverLocation.create({
      data: {
        driverId,
        lat,
        lng,
        recordedAt: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
      },
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    console.error('Error saving driver location:', error);
    return NextResponse.json({ error: 'Failed to save driver location' }, { status: 500 });
  }
}
