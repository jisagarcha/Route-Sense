import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/locations - Get all locations
export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            roadsFrom: true,
            roadsTo: true,
          },
        },
      },
    });

    return NextResponse.json({ locations }, { status: 200 });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

// POST /api/locations - Create a new location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, latitude, longitude } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Check if location with same name already exists
    const existing = await prisma.location.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A location with this name already exists' },
        { status: 409 }
      );
    }

    // Validate latitude and longitude if provided
    if (latitude !== undefined && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
      return NextResponse.json(
        { error: 'Latitude must be a number between -90 and 90' },
        { status: 400 }
      );
    }

    if (longitude !== undefined && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
      return NextResponse.json(
        { error: 'Longitude must be a number between -180 and 180' },
        { status: 400 }
      );
    }

    const location = await prisma.location.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    );
  }
}
