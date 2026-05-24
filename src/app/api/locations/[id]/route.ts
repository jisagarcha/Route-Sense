import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/locations/:id - Get a specific location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const locationId = parseInt(id);

    if (isNaN(locationId)) {
      return NextResponse.json(
        { error: 'Invalid location ID' },
        { status: 400 }
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        roadsFrom: {
          include: {
            toLocation: true,
          },
        },
        roadsTo: {
          include: {
            fromLocation: true,
          },
        },
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ location }, { status: 200 });
  } catch (error) {
    console.error('Error fetching location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    );
  }
}

// PUT /api/locations/:id - Update a location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const locationId = parseInt(id);

    if (isNaN(locationId)) {
      return NextResponse.json(
        { error: 'Invalid location ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, latitude, longitude } = body;

    // Check if location exists
    const existing = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Name must be a non-empty string' },
          { status: 400 }
        );
      }

      // Check if another location with the same name exists
      const duplicateName = await prisma.location.findFirst({
        where: {
          name: name.trim(),
          id: { not: locationId },
        },
      });

      if (duplicateName) {
        return NextResponse.json(
          { error: 'A location with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Validate latitude and longitude if provided
    if (latitude !== undefined && latitude !== null && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
      return NextResponse.json(
        { error: 'Latitude must be a number between -90 and 90' },
        { status: 400 }
      );
    }

    if (longitude !== undefined && longitude !== null && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
      return NextResponse.json(
        { error: 'Longitude must be a number between -180 and 180' },
        { status: 400 }
      );
    }

    const location = await prisma.location.update({
      where: { id: locationId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(latitude !== undefined && { latitude: latitude ?? null }),
        ...(longitude !== undefined && { longitude: longitude ?? null }),
      },
    });

    return NextResponse.json({ location }, { status: 200 });
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}

// DELETE /api/locations/:id - Delete a location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const locationId = parseInt(id);

    if (isNaN(locationId)) {
      return NextResponse.json(
        { error: 'Invalid location ID' },
        { status: 400 }
      );
    }

    // Check if location exists
    const existing = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Delete location (cascade will handle related roads and route requests)
    await prisma.location.delete({
      where: { id: locationId },
    });

    return NextResponse.json(
      { message: 'Location deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting location:', error);
    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    );
  }
}
