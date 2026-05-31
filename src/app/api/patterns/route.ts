import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apriori, formatSupport, getItemsetDescription } from '@/lib/apriori';

const algorithmInfo = {
  name: 'Apriori',
  complexity: 'Exponential (worst case), pruned by minimum support',
  description: 'Frequent itemset mining to discover common location patterns',
};

// GET /api/patterns - Run Apriori algorithm on historical routes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minSupportParam = searchParams.get('minSupport');
    const minItemsetSizeParam = searchParams.get('minItemsetSize');
    const maxItemsetSizeParam = searchParams.get('maxItemsetSize');

    // Parse parameters with defaults
    const minSupport = minSupportParam
      ? parseFloat(minSupportParam)
      : 0.3;
    const minItemsetSize = minItemsetSizeParam
      ? parseInt(minItemsetSizeParam)
      : 2;
    const maxItemsetSize = maxItemsetSizeParam
      ? parseInt(maxItemsetSizeParam)
      : undefined;

    // Validation
    if (isNaN(minSupport) || minSupport < 0 || minSupport > 1) {
      return NextResponse.json(
        { error: 'minSupport must be a number between 0 and 1' },
        { status: 400 }
      );
    }

    if (isNaN(minItemsetSize) || minItemsetSize < 1) {
      return NextResponse.json(
        { error: 'minItemsetSize must be a positive integer' },
        { status: 400 }
      );
    }

    const driverRoutes = await prisma.package.findMany({
      where: {
        driverId: { not: null },
        status: {
          in: [
            'ASSIGNED',
            'COLLECTED_FROM_WAREHOUSE',
            'IN_TRANSIT',
            'DELIVERED',
            'FAILED',
          ],
        },
      },
      select: {
        id: true,
        packageName: true,
        warehouseAddress: true,
        warehouseLat: true,
        warehouseLong: true,
        deliveryAddress: true,
        items: {
          select: {
            deliveryAddress: true,
            deliveryLat: true,
            deliveryLong: true,
            sequence: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const driverTransactions = driverRoutes
      .map((route) => getDeliveryTransaction(route))
      .filter((transaction) => transaction.length >= minItemsetSize);

    // Keep shortest-path route requests as a fallback/source for older demo data.
    const routeRequests = await prisma.routeRequest.findMany({
      select: {
        id: true,
        pathLocations: true,
      },
    });
    const routeRequestTransactions = routeRequests
      .map((route) => route.pathLocations)
      .filter((transaction) => transaction.length >= minItemsetSize);

    const transactions = [...driverTransactions, ...routeRequestTransactions];

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          frequentItemsets: [],
          minSupport,
          totalTransactions: 0,
          algorithm: algorithmInfo,
          message: 'No driver route history or route requests found in the database',
        },
        { status: 200 }
      );
    }

    // Run Apriori algorithm
    const result = apriori(
      transactions,
      minSupport,
      minItemsetSize,
      maxItemsetSize
    );

    // Format results for response
    const formattedItemsets = result.frequentItemsets.map((itemset) => ({
      locations: itemset.items,
      description: getItemsetDescription(itemset.items),
      support: itemset.support,
      supportPercentage: formatSupport(itemset.support),
      count: itemset.count,
      size: itemset.items.length,
    }));

    return NextResponse.json(
      {
        frequentItemsets: formattedItemsets,
        minSupport,
        totalTransactions: result.totalTransactions,
        transactionSources: {
          driverRoutes: driverTransactions.length,
          routeRequests: routeRequestTransactions.length,
        },
        algorithm: algorithmInfo,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error running pattern mining:', error);
    return NextResponse.json(
      { error: 'Failed to run pattern mining' },
      { status: 500 }
    );
  }
}

function getDeliveryTransaction(route: {
  packageName: string;
  warehouseAddress: string | null;
  warehouseLat: number | null;
  warehouseLong: number | null;
  deliveryAddress: string | null;
  items: Array<{
    deliveryAddress: string | null;
    deliveryLat: number | null;
    deliveryLong: number | null;
  }>;
}) {
  const labels = new Set<string>();

  const warehouseLabel =
    formatCoordinateLabel(route.warehouseLat, route.warehouseLong) ||
    (route.warehouseAddress ? normalizeLocationLabel(route.warehouseAddress) : null);
  if (warehouseLabel) labels.add(warehouseLabel);

  for (const item of route.items) {
    labels.add(
      normalizeLocationLabel(
        formatCoordinateLabel(item.deliveryLat, item.deliveryLong) ||
          item.deliveryAddress ||
          route.deliveryAddress ||
          route.packageName
      )
    );
  }

  if (labels.size === 0 && route.deliveryAddress) {
    labels.add(normalizeLocationLabel(route.deliveryAddress));
  }

  return Array.from(labels).filter(Boolean);
}

function normalizeLocationLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function formatCoordinateLabel(lat: number | null, lng: number | null) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  return `Zone ${Number(lat).toFixed(2)}, ${Number(lng).toFixed(2)}`;
}
