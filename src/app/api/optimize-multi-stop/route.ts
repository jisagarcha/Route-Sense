import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateShortestPath } from '@/lib/graph';
import { prisma } from '@/lib/prisma';

interface Stop {
  productId: string;
  lat: number;
  long: number;
  address: string;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Nearest Neighbor algorithm for TSP (Traveling Salesman Problem)
function optimizeRouteNearestNeighbor(
  startLat: number,
  startLong: number,
  stops: Stop[]
): { optimizedSequence: number[]; totalDistance: number } {
  const unvisited = new Set(stops.map((_, index) => index));
  const sequence: number[] = [];
  let currentLat = startLat;
  let currentLong = startLong;
  let totalDistance = 0;

  while (unvisited.size > 0) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    unvisited.forEach(index => {
      const stop = stops[index];
      const distance = calculateDistance(currentLat, currentLong, stop.lat, stop.long);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    if (nearestIndex !== -1) {
      sequence.push(nearestIndex);
      unvisited.delete(nearestIndex);
      totalDistance += nearestDistance;
      currentLat = stops[nearestIndex].lat;
      currentLong = stops[nearestIndex].long;
    }
  }

  return { optimizedSequence: sequence, totalDistance };
}

// Try to use Dijkstra with actual road network if locations exist
// TODO: Re-enable with caching and optimization for better performance
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function optimizeRouteWithRoads(
  startLat: number,
  startLong: number,
  stops: Stop[]
): Promise<{ optimizedSequence: number[]; totalDistance: number; algorithm: string } | null> {
  try {
    // Find nearest location to warehouse
    const locations = await prisma.location.findMany();
    if (locations.length === 0) return null;

    // For each stop, find nearest location in database
    const stopLocations = await Promise.all(
      stops.map(async (stop) => {
        let nearestLocation = locations[0];
        // Check if location has valid coordinates
        if (nearestLocation.latitude === null || nearestLocation.longitude === null) {
          return nearestLocation;
        }
        
        let minDistance = calculateDistance(stop.lat, stop.long, nearestLocation.latitude, nearestLocation.longitude);

        locations.forEach(loc => {
          // Skip locations without coordinates
          if (loc.latitude === null || loc.longitude === null) return;
          
          const distance = calculateDistance(stop.lat, stop.long, loc.latitude, loc.longitude);
          if (distance < minDistance) {
            minDistance = distance;
            nearestLocation = loc;
          }
        });

        return nearestLocation;
      })
    );

    // Find warehouse location
    let warehouseLocation = locations[0];
    // Check if warehouse location has valid coordinates
    if (warehouseLocation.latitude === null || warehouseLocation.longitude === null) {
      return null; // Cannot proceed without valid warehouse coordinates
    }
    
    let minWarehouseDist = calculateDistance(startLat, startLong, warehouseLocation.latitude, warehouseLocation.longitude);
    locations.forEach(loc => {
      // Skip locations without coordinates
      if (loc.latitude === null || loc.longitude === null) return;
      
      const distance = calculateDistance(startLat, startLong, loc.latitude, loc.longitude);
      if (distance < minWarehouseDist) {
        minWarehouseDist = distance;
        warehouseLocation = loc;
      }
    });

    // Build graph
    const roads = await prisma.road.findMany();
    const graph: Record<number, { node: number; weight: number }[]> = {};
    
    roads.forEach(road => {
      if (!graph[road.fromLocationId]) graph[road.fromLocationId] = [];
      if (!graph[road.toLocationId]) graph[road.toLocationId] = [];
      graph[road.fromLocationId].push({ node: road.toLocationId, weight: road.distance });
      if (road.isBidirectional) {
        graph[road.toLocationId].push({ node: road.fromLocationId, weight: road.distance });
      }
    });

    // Use nearest neighbor with actual road distances
    const unvisited = new Set(stops.map((_, index) => index));
    const sequence: number[] = [];
    let currentLocId = warehouseLocation.id;
    let totalDistance = 0;

    while (unvisited.size > 0) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;

      unvisited.forEach(index => {
        const targetLocId = stopLocations[index].id;
        const pathResult = calculateShortestPath(graph, currentLocId, targetLocId);
        if (pathResult.distance < nearestDistance) {
          nearestDistance = pathResult.distance;
          nearestIndex = index;
        }
      });

      if (nearestIndex !== -1) {
        sequence.push(nearestIndex);
        unvisited.delete(nearestIndex);
        totalDistance += nearestDistance;
        currentLocId = stopLocations[nearestIndex].id;
      } else {
        break;
      }
    }

    return {
      optimizedSequence: sequence,
      totalDistance,
      algorithm: 'Dijkstra with Nearest Neighbor'
    };
  } catch (error) {
    console.error('Error using road network:', error);
    return null;
  }
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

    const { warehouseLat, warehouseLong, stops } = await req.json();

    if (!stops || stops.length === 0) {
      return NextResponse.json({ error: 'No stops provided' }, { status: 400 });
    }

    console.log(`Optimizing route for ${stops.length} stops...`);

    // Use simple Nearest Neighbor algorithm for now (faster and more reliable)
    // TODO: Implement road network optimization with caching for better performance
    const result = optimizeRouteNearestNeighbor(warehouseLat, warehouseLong, stops);
    const algorithm = 'Nearest Neighbor (Haversine)';

    // Estimate duration: average 30 km/h in city + 2 minutes per stop
    const estimatedDuration = Math.round((result.totalDistance / 30) * 60 + (stops.length * 2));

    return NextResponse.json({
      optimizedSequence: result.optimizedSequence,
      totalDistance: result.totalDistance,
      estimatedDuration,
      algorithm,
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
