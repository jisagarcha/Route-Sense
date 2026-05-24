import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/route-history - Get all route requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const limit = limitParam ? parseInt(limitParam) : 50;
    const offset = offsetParam ? parseInt(offsetParam) : 0;

    const routeRequests = await prisma.routeRequest.findMany({
      include: {
        sourceLocation: true,
        targetLocation: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.routeRequest.count();

    return NextResponse.json(
      {
        routeRequests,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching route history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch route history' },
      { status: 500 }
    );
  }
}
