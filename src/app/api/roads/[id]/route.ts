import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/roads/:id - Get a specific road
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roadId = parseInt(id);

    if (isNaN(roadId)) {
      return NextResponse.json(
        { error: 'Invalid road ID' },
        { status: 400 }
      );
    }

    const road = await prisma.road.findUnique({
      where: { id: roadId },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    if (!road) {
      return NextResponse.json(
        { error: 'Road not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ road }, { status: 200 });
  } catch (error) {
    console.error('Error fetching road:', error);
    return NextResponse.json(
      { error: 'Failed to fetch road' },
      { status: 500 }
    );
  }
}

// PUT /api/roads/:id - Update a road
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roadId = parseInt(id);

    if (isNaN(roadId)) {
      return NextResponse.json(
        { error: 'Invalid road ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { distance, isBidirectional } = body;

    // Check if road exists
    const existing = await prisma.road.findUnique({
      where: { id: roadId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Road not found' },
        { status: 404 }
      );
    }

    // Validate distance if provided
    if (distance !== undefined && (typeof distance !== 'number' || distance <= 0)) {
      return NextResponse.json(
        { error: 'distance must be a positive number' },
        { status: 400 }
      );
    }

    const road = await prisma.road.update({
      where: { id: roadId },
      data: {
        ...(distance !== undefined && { distance }),
        ...(isBidirectional !== undefined && { isBidirectional }),
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    return NextResponse.json({ road }, { status: 200 });
  } catch (error) {
    console.error('Error updating road:', error);
    return NextResponse.json(
      { error: 'Failed to update road' },
      { status: 500 }
    );
  }
}

// DELETE /api/roads/:id - Delete a road
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roadId = parseInt(id);

    if (isNaN(roadId)) {
      return NextResponse.json(
        { error: 'Invalid road ID' },
        { status: 400 }
      );
    }

    // Check if road exists
    const existing = await prisma.road.findUnique({
      where: { id: roadId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Road not found' },
        { status: 404 }
      );
    }

    await prisma.road.delete({
      where: { id: roadId },
    });

    return NextResponse.json(
      { message: 'Road deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting road:', error);
    return NextResponse.json(
      { error: 'Failed to delete road' },
      { status: 500 }
    );
  }
}
