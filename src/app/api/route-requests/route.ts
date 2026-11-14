import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/route-requests - Get all historical route requests
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN' && session.user.role !== 'ANALYST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const routeRequests = await prisma.routeRequest.findMany({
      include: {
        sourceLocation: true,
        targetLocation: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ routeRequests }, { status: 200 });
  } catch (error) {
    console.error('Error fetching route requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch route requests' },
      { status: 500 }
    );
  }
}
