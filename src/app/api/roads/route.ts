import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/roads - Get all roads
export async function GET() {
  try {
    const roads = await prisma.road.findMany({
      include: {
        fromLocation: true,
        toLocation: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ roads }, { status: 200 });
  } catch (error) {
    console.error('Error fetching roads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roads' },
      { status: 500 }
    );
  }
}

// POST /api/roads - Create a new road
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromLocationId, toLocationId, distance, isBidirectional } = body;

    // Validation
    if (!fromLocationId || typeof fromLocationId !== 'number') {
      return NextResponse.json(
        { error: 'fromLocationId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!toLocationId || typeof toLocationId !== 'number') {
      return NextResponse.json(
        { error: 'toLocationId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!distance || typeof distance !== 'number' || distance <= 0) {
      return NextResponse.json(
        { error: 'distance is required and must be a positive number' },
        { status: 400 }
      );
    }

    // Validate that from and to are different
    if (fromLocationId === toLocationId) {
      return NextResponse.json(
        { error: 'fromLocation and toLocation must be different' },
        { status: 400 }
      );
    }

    // Check if both locations exist
    const fromLocation = await prisma.location.findUnique({
      where: { id: fromLocationId },
    });

    const toLocation = await prisma.location.findUnique({
      where: { id: toLocationId },
    });

    if (!fromLocation) {
      return NextResponse.json(
        { error: 'Source location not found' },
        { status: 404 }
      );
    }

    if (!toLocation) {
      return NextResponse.json(
        { error: 'Destination location not found' },
        { status: 404 }
      );
    }

    // Check if road already exists
    const existingRoad = await prisma.road.findFirst({
      where: {
        fromLocationId,
        toLocationId,
      },
    });

    if (existingRoad) {
      return NextResponse.json(
        { error: 'A road between these locations already exists' },
        { status: 409 }
      );
    }

    const road = await prisma.road.create({
      data: {
        fromLocationId,
        toLocationId,
        distance,
        isBidirectional: isBidirectional ?? false,
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    return NextResponse.json({ road }, { status: 201 });
  } catch (error) {
    console.error('Error creating road:', error);
    return NextResponse.json(
      { error: 'Failed to create road' },
      { status: 500 }
    );
  }
}
