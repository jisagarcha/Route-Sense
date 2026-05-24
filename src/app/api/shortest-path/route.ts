import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildAdjacencyList, dijkstra, astar, findAlternativeRoutes, RouteCache, GraphNode } from '@/lib/routing-engine';
import { findSimilarRoutes, RouteVector } from '@/lib/similarity';

// Global route cache (persist across requests)
const routeCache = new RouteCache(1000, 60);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceLocationId, targetLocationId, algorithm = 'astar', useCache = true } = body;

    // Validation
    if (!sourceLocationId || typeof sourceLocationId !== 'number') {
      return NextResponse.json(
        { error: 'sourceLocationId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!targetLocationId || typeof targetLocationId !== 'number') {
      return NextResponse.json(
        { error: 'targetLocationId is required and must be a number' },
        { status: 400 }
      );
    }

    if (sourceLocationId === targetLocationId) {
      return NextResponse.json(
        { error: 'Source and target locations must be different' },
        { status: 400 }
      );
    }

    // Check cache first
    if (useCache) {
      const cachedResult = routeCache.get(sourceLocationId, targetLocationId);
      if (cachedResult) {
        console.log('✅ Cache hit for route', sourceLocationId, '→', targetLocationId);
        
        // Still need to fetch location names for response
        const sourceLocation = await prisma.location.findUnique({
          where: { id: sourceLocationId },
        });
        const targetLocation = await prisma.location.findUnique({
          where: { id: targetLocationId },
        });
        
        const cachedLocations = await prisma.location.findMany({
          where: { id: { in: cachedResult.path } },
          select: { id: true, name: true },
        });
        const cachedLocationMap = new Map(cachedLocations.map((loc) => [loc.id, loc.name]));
        const cachedPath = cachedResult.path.map((id) => ({
          id,
          name: cachedLocationMap.get(id) || 'Unknown',
        }));

        return NextResponse.json({
          found: cachedResult.found,
          cached: true,
          route: {
            path: cachedPath,
            totalDistance: cachedResult.distance,
            hops: cachedResult.path.length - 1,
            sourceLocation: sourceLocation?.name,
            targetLocation: targetLocation?.name,
          },
          performance: {
            executionTime: cachedResult.executionTime,
            nodesExplored: cachedResult.nodesExplored,
            algorithm: algorithm === 'astar' ? 'A*' : 'Dijkstra',
          },
        });
      }
    }

    // Fetch locations
    const sourceLocation = await prisma.location.findUnique({
      where: { id: sourceLocationId },
    });

    const targetLocation = await prisma.location.findUnique({
      where: { id: targetLocationId },
    });

    if (!sourceLocation) {
      return NextResponse.json(
        { error: 'Source location not found' },
        { status: 404 }
      );
    }

    if (!targetLocation) {
      return NextResponse.json(
        { error: 'Target location not found' },
        { status: 404 }
      );
    }

    // Fetch all locations and roads
    const allLocations = await prisma.location.findMany();
    const allRoads = await prisma.road.findMany();

    if (allRoads.length === 0) {
      return NextResponse.json(
        { error: 'No roads defined in the system' },
        { status: 400 }
      );
    }

    // Build graph edges considering bidirectional roads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edges = allRoads.flatMap((road: any) => {
      const baseEdge = {
        from: road.fromLocationId,
        to: road.toLocationId,
        weight: road.distance,
      };
      
      if (road.isBidirectional) {
        return [
          baseEdge,
          { from: road.toLocationId, to: road.fromLocationId, weight: road.distance },
        ];
      }
      
      return [baseEdge];
    });

    // Build adjacency list
    const adjacencyList = buildAdjacencyList(edges);

    // Get all node IDs and create node map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeIds = allLocations.map((loc: any) => loc.id);
    const nodeMap = new Map<number, GraphNode>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allLocations.forEach((loc: any) => {
      nodeMap.set(loc.id, {
        id: loc.id,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    });

    // Run selected algorithm
    let result;
    let usedAlgorithm = 'Dijkstra';
    
    if (algorithm === 'astar' && allLocations.every((loc: { latitude: number | null; longitude: number | null }) => loc.latitude !== null && loc.longitude !== null)) {
      result = astar(adjacencyList, sourceLocationId, targetLocationId, nodeMap);
      usedAlgorithm = 'A*';
    } else {
      result = dijkstra(adjacencyList, sourceLocationId, targetLocationId, nodeIds);
      usedAlgorithm = 'Dijkstra';
    }

    // Cache the result
    if (useCache) {
      routeCache.set(sourceLocationId, targetLocationId, result);
    }

    if (!result.found) {
      return NextResponse.json(
        {
          found: false,
          message: 'No route found between the selected locations',
        },
        { status: 200 }
      );
    }

    // Map location IDs to names
    const locationMap = new Map<number, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allLocations.forEach((loc: any) => {
      locationMap.set(loc.id, loc.name);
    });

    const pathWithNames = result.path.map((id) => ({
      id,
      name: locationMap.get(id) || 'Unknown',
    }));

    const pathLocationNames = result.path.map((id) => {
      const name = locationMap.get(id);
      return name !== undefined ? name : 'Unknown';
    });

    // Store the route request
    const routeRequest = await prisma.routeRequest.create({
      data: {
        sourceLocationId,
        targetLocationId,
        totalDistance: result.distance,
        pathLocations: pathLocationNames,
      },
    });

    // Fetch recent route requests for similarity comparison (last 50)
    const pastRoutes = await prisma.routeRequest.findMany({
      where: {
        id: { not: routeRequest.id },
      },
      include: {
        sourceLocation: true,
        targetLocation: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // Convert to RouteVector format for similarity calculation
    const pastRouteVectors: RouteVector[] = pastRoutes.map((route: { 
      id: number; 
      pathLocations: string[]; 
      totalDistance: number; 
      sourceLocation: { name: string }; 
      targetLocation: { name: string }; 
      createdAt: Date 
    }) => ({
      routeId: route.id,
      locations: route.pathLocations,
      totalDistance: route.totalDistance,
      sourceLocation: route.sourceLocation.name,
      targetLocation: route.targetLocation.name,
      createdAt: route.createdAt,
    }));

    // Find similar routes
    const similarRoutes = findSimilarRoutes(
      pathLocationNames,
      pastRouteVectors,
      3, // Top 3 similar routes
      0.1 // Minimum 10% similarity
    );

    // Find alternative routes
    const alternatives = findAlternativeRoutes(
      adjacencyList,
      sourceLocationId,
      targetLocationId,
      nodeIds,
      3
    ).slice(1); // Exclude the main route

    return NextResponse.json(
      {
        found: true,
        route: {
          path: pathWithNames,
          totalDistance: result.distance,
          hops: result.path.length - 1,
          sourceLocation: sourceLocation.name,
          targetLocation: targetLocation.name,
        },
        alternativeRoutes: alternatives.map((alt) => ({
          path: alt.path.map((id) => ({
            id,
            name: locationMap.get(id) || 'Unknown',
          })),
          totalDistance: alt.distance,
          similarity: alt.similarity,
          similarityPercentage: `${(alt.similarity * 100).toFixed(1)}%`,
          timeDifference: `+${((alt.distance / result.distance - 1) * 100).toFixed(1)}%`,
        })),
        similarRoutes: similarRoutes.map((sr) => ({
          routeId: sr.routeId,
          path: sr.locations,
          totalDistance: sr.totalDistance,
          similarity: sr.similarity,
          similarityPercentage: `${(sr.similarity * 100).toFixed(1)}%`,
          sourceLocation: sr.sourceLocation,
          targetLocation: sr.targetLocation,
          createdAt: sr.createdAt,
        })),
        algorithm: {
          name: usedAlgorithm,
          complexity: usedAlgorithm === 'A*' ? 'O((V + E) log V)' : 'O((V + E) log V)',
          description: usedAlgorithm === 'A*' 
            ? 'Informed search algorithm using heuristic distance for optimal pathfinding'
            : 'Greedy algorithm for finding shortest paths in weighted graphs',
        },
        performance: {
          executionTime: result.executionTime,
          nodesExplored: result.nodesExplored,
          cacheStats: routeCache.getStats(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error computing shortest path:', error);
    return NextResponse.json(
      { error: 'Failed to compute shortest path' },
      { status: 500 }
    );
  }
}
