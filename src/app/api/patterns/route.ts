import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apriori, formatSupport, getItemsetDescription } from '@/lib/apriori';

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

    // Fetch all route requests
    const routeRequests = await prisma.routeRequest.findMany({
      select: {
        id: true,
        pathLocations: true,
      },
    });

    if (routeRequests.length === 0) {
      return NextResponse.json(
        {
          frequentItemsets: [],
          minSupport,
          totalTransactions: 0,
          message: 'No route requests found in the database',
        },
        { status: 200 }
      );
    }

    // Extract transactions (each route's pathLocations)
    const transactions = routeRequests.map((route: { pathLocations: string[] }) => route.pathLocations);

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
        algorithm: {
          name: 'Apriori',
          complexity: 'Exponential (worst case), pruned by minimum support',
          description: 'Frequent itemset mining to discover common location patterns',
        },
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
