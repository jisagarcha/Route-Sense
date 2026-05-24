import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/packages - Get all packages
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const driverId = searchParams.get('driverId');
    const dispatcherId = searchParams.get('dispatcherId');

    const where: Record<string, unknown> = {};

    // Role-based filtering
    if (session.user.role === 'DRIVER') {
      where.driverId = session.user.id;
    } else if (session.user.role === 'DISPATCHER') {
      where.dispatcherId = session.user.id;
    }

    // Additional filters
    if (status) {
      where.status = status;
    }

    if (driverId && session.user.role === 'ADMIN') {
      where.driverId = driverId;
    }

    if (dispatcherId && session.user.role === 'ADMIN') {
      where.dispatcherId = dispatcherId;
    }

    const packages = await prisma.package.findMany({
      where,
      include: {
        dispatcher: {
          select: { id: true, name: true, email: true },
        },
        driver: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            product: true,
          },
        },
        delivery: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}

// POST /api/packages - Create a new package (Multi-Stop Support)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'DISPATCHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      packageName,
      warehouseLat,
      warehouseLong,
      totalDistance,
      estimatedDuration,
      routeAlgorithm,
      items,
      notes,
    } = body;

    // Validate required fields
    if (!packageName || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: packageName and items are required' },
        { status: 400 }
      );
    }

    // Validate each item has productId and quantity
    for (const item of items) {
      if (!item.productId || !item.quantity) {
        return NextResponse.json(
          { error: 'Each item must have productId and quantity' },
          { status: 400 }
        );
      }
    }

    // Calculate package attributes
    let totalWeight = 0;
    let totalVolume = 0;
    let isCritical = false;

    // Fetch product details to calculate totals
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        );
      }

      totalWeight += product.weight * item.quantity;
      totalVolume += product.volumeCubicFt * item.quantity;
      if (product.isCritical) {
        isCritical = true;
      }
    }

    // Create package with items (Multi-Stop)
    const packageData = await prisma.package.create({
      data: {
        packageName,
        dispatcherId: session.user.id,
        totalWeight,
        totalVolume,
        isCritical,
        warehouseLat,
        warehouseLong,
        totalDistance,
        estimatedDuration,
        routeAlgorithm,
        notes,
        items: {
          create: items.map((item: {
            productId: string;
            quantity: number;
            deliveryLat?: number;
            deliveryLong?: number;
            deliveryAddress?: string;
            sequence?: number;
          }) => ({
            productId: item.productId,
            quantity: item.quantity,
            deliveryLat: item.deliveryLat || null,
            deliveryLong: item.deliveryLong || null,
            deliveryAddress: item.deliveryAddress || null,
            sequence: item.sequence || null,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            sequence: 'asc', // Return items in optimized route order
          },
        },
      },
    });

    return NextResponse.json({
      package: packageData,
      message: 'Multi-stop package created successfully',
    });
  } catch (error) {
    console.error('Error creating package:', error);
    return NextResponse.json(
      { error: 'Failed to create package' },
      { status: 500 }
    );
  }
}
