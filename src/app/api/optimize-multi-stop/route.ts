import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { haversineDistance } from '@/lib/routing-engine';
import { buildDistanceMatrix, solveTSP, TSPLocation } from '@/lib/tsp-solver';

interface Stop {
  productId: string;
  lat: number;
  long: number;
  address: string;
}

function normalizeAlgorithm(algorithm: string | undefined) {
  const normalized = (algorithm || 'nearest-neighbor').toLowerCase();
  if (normalized === 'genetic') return 'genetic';
  if (normalized === '2-opt') return '2-opt';
  if (normalized === 'simulated-annealing') return 'simulated-annealing';
  return 'nearest-neighbor';
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'DISPATCHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only dispatchers can optimize routes' }, { status: 403 });
    }

    const { warehouseLat, warehouseLong, stops, algorithm } = await req.json();

    if (!Array.isArray(stops) || stops.length === 0) {
      return NextResponse.json({ error: 'No stops provided' }, { status: 400 });
    }

    if (!Number.isFinite(warehouseLat) || !Number.isFinite(warehouseLong)) {
      return NextResponse.json({ error: 'Valid warehouse coordinates are required' }, { status: 400 });
    }

    const invalidStop = stops.find((stop: Stop) =>
      !Number.isFinite(stop.lat) || !Number.isFinite(stop.long)
    );

    if (invalidStop) {
      return NextResponse.json({ error: 'Every stop must include valid coordinates' }, { status: 400 });
    }

    const tspLocations: TSPLocation[] = [
      {
        id: 0,
        name: 'Warehouse',
        latitude: warehouseLat,
        longitude: warehouseLong,
      },
      ...stops.map((stop: Stop, index: number) => ({
        id: index + 1,
        name: stop.address || stop.productId || `Stop ${index + 1}`,
        latitude: stop.lat,
        longitude: stop.long,
      })),
    ];

    const distanceMatrix = buildDistanceMatrix(
      tspLocations,
      (loc1, loc2) =>
        haversineDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude)
    );

    const selectedAlgorithm = normalizeAlgorithm(algorithm);
    const result = solveTSP(tspLocations, distanceMatrix, selectedAlgorithm, 0);
    const optimizedSequence = result.path.filter((id) => id !== 0).map((id) => id - 1);

    // Estimate duration: average 30 km/h in city + 2 minutes per stop
    const estimatedDuration = Math.round((result.totalDistance / 30) * 60 + (stops.length * 2));

    return NextResponse.json({
      optimizedSequence,
      totalDistance: result.totalDistance,
      estimatedDuration,
      algorithm: result.algorithm,
      executionTime: result.executionTime,
      success: true
    });

  } catch (error) {
    console.error('Error optimizing route:', error);
    return NextResponse.json(
      { error: 'Failed to optimize route' },
      { status: 500 }
    );
  }
}
