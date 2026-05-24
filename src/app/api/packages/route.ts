import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface IncomingPackageItem {
  productId: string;
  quantity: number;
  deliveryLat?: number;
  deliveryLong?: number;
  deliveryAddress?: string;
  sequence?: number;
}

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
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 100);
    const offset = Math.max(Number(offsetParam) || 0, 0);

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

    const [packages, total] = await prisma.$transaction([
      prisma.package.findMany({
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
            orderBy: {
              sequence: 'asc',
            },
          },
          delivery: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.package.count({ where }),
    ]);

    return NextResponse.json({
      packages,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
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
    if (!session || (session.user.role !== 'DISPATCHER' && session.user.role !== 'ADMIN')) {
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
      items: rawItems,
      notes,
    } = body;
    const items = Array.isArray(rawItems) ? rawItems as IncomingPackageItem[] : [];

    // Validate required fields
    if (!packageName || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: packageName and items are required' },
        { status: 400 }
      );
    }

    // Validate each item has productId and quantity
    for (const item of items) {
      if (!item.productId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
        return NextResponse.json(
          { error: 'Each item must have productId and quantity' },
          { status: 400 }
        );
      }
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        );
      }
    }

    // Single product lookup avoids repeated database queries for multi-item packages.
    const totals = items.reduce(
      (
        acc: { totalWeight: number; totalVolume: number; isCritical: boolean },
        item: IncomingPackageItem
      ) => {
        const product = productMap.get(item.productId)!;
        acc.totalWeight += product.weight * item.quantity;
        acc.totalVolume += product.volumeCubicFt * item.quantity;
        acc.isCritical = acc.isCritical || product.isCritical;
        return acc;
      },
      { totalWeight: 0, totalVolume: 0, isCritical: false }
    );

    // Create package with items (Multi-Stop)
    const packageData = await prisma.package.create({
      data: {
        packageName,
        dispatcherId: session.user.id,
        totalWeight: totals.totalWeight,
        totalVolume: totals.totalVolume,
        isCritical: totals.isCritical,
        warehouseLat,
        warehouseLong,
        totalDistance,
        estimatedDuration,
        routeAlgorithm,
        notes,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            deliveryLat: item.deliveryLat || null,
            deliveryLong: item.deliveryLong || null,
            deliveryAddress: item.deliveryAddress || null,
            sequence: item.sequence ?? null,
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
