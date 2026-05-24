import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/route-requests - Get all historical route requests
export async function GET() {
  try {
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
