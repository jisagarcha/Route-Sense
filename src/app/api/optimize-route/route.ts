import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/routing-engine";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  solveTSP,
  TSPLocation,
  DistanceMatrix,
} from "@/lib/tsp-solver";
import { getTravelMatrix, getRoadRouteGeometry } from "@/lib/delivery-routing";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const {
      locationIds,
      algorithm = "auto",
      startLocationId,
      returnToStart = false,
    } = body;

    // Validation
    if (!locationIds || !Array.isArray(locationIds) || locationIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 location IDs are required" },
        { status: 400 }
      );
    }

    // Fetch all requested locations
    const locations = await prisma.location.findMany({
      where: {
        id: {
          in: locationIds,
        },
      },
    });

    if (locations.length !== locationIds.length) {
      return NextResponse.json(
        { error: "One or more locations not found" },
        { status: 404 }
      );
    }

    // Validate all locations have coordinates
    const invalidLocations = locations.filter(
      (loc) => loc.latitude == null || loc.longitude == null
    );

    if (invalidLocations.length > 0) {
      return NextResponse.json(
        {
          error: `Locations without coordinates: ${invalidLocations
            .map((l) => l.name)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Convert to TSP format
    const tspLocations: TSPLocation[] = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      latitude: loc.latitude!,
      longitude: loc.longitude!,
    }));

    // Build distance matrix using real OSRM road distance
    const geoPoints = tspLocations.map((loc) => ({ lat: loc.latitude, lng: loc.longitude }));
    const travelMatrix = await getTravelMatrix(geoPoints);

    const distanceMatrix: DistanceMatrix = {};
    tspLocations.forEach((loc1, i) => {
      distanceMatrix[loc1.id] = {};
      tspLocations.forEach((loc2, j) => {
        if (loc1.id === loc2.id) {
          distanceMatrix[loc1.id][loc2.id] = 0;
        } else {
          // distancesM is in meters; convert to km
          let roadDistKm = 0;
          if (travelMatrix.distancesM?.[i]?.[j] != null && travelMatrix.distancesM[i][j] > 0) {
            roadDistKm = travelMatrix.distancesM[i][j] / 1000;
          } else {
            const straightLine = haversineDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
            roadDistKm = straightLine > 0 ? straightLine * 1.35 : 0.05; // 50m minimum if duplicate coords
          }
          distanceMatrix[loc1.id][loc2.id] = roadDistKm;
        }
      });
    });

    // Solve TSP
    const result = solveTSP(
      tspLocations,
      distanceMatrix,
      algorithm,
      startLocationId
    );

    // Add return to start if requested
    if (returnToStart && result.path.length > 0) {
      const firstId = result.path[0];
      const lastId = result.path[result.path.length - 1];
      result.path.push(firstId);
      result.totalDistance += distanceMatrix[lastId][firstId];
    }

    // Map IDs to location details
    const locationMap = new Map(locations.map((loc) => [loc.id, loc]));
    const pathWithDetails = result.path.map((id, index) => {
      const loc = locationMap.get(id);
      return {
        sequence: index + 1,
        id: loc!.id,
        name: loc!.name,
        description: loc!.description,
        latitude: loc!.latitude,
        longitude: loc!.longitude,
      };
    });

    // Calculate segment distances
    const segments = [];
    for (let i = 0; i < result.path.length - 1; i++) {
      const fromId = result.path[i];
      const toId = result.path[i + 1];
      segments.push({
        from: locationMap.get(fromId)!.name,
        to: locationMap.get(toId)!.name,
        distance: parseFloat((distanceMatrix[fromId]?.[toId] || 0).toFixed(2)),
      });
    }

    // Get actual road polyline from OSRM for the ordered stops
    const orderedPoints = pathWithDetails.map((loc) => ({
      lat: loc.latitude!,
      lng: loc.longitude!,
    }));
    const roadGeometry = await getRoadRouteGeometry(orderedPoints);

    const effectiveTotalDistance =
      roadGeometry.distanceKm > 0
        ? roadGeometry.distanceKm
        : result.totalDistance;

    // Estimate time (using OSRM duration or 30 km/h average speed)
    const estimatedMinutes =
      roadGeometry.durationMin > 0
        ? Math.round(roadGeometry.durationMin)
        : Math.round((effectiveTotalDistance / 30) * 60);
    const estimatedHours = parseFloat((estimatedMinutes / 60).toFixed(2));

    // Calculate fuel cost (assuming 10 km/l and $1.5/liter)
    const fuelEfficiency = 10; // km/l
    const fuelPrice = 1.5; // $/liter
    const fuelCost = (effectiveTotalDistance / fuelEfficiency) * fuelPrice;

    return NextResponse.json(
      {
        success: true,
        optimization: {
          path: pathWithDetails,
          geometry: roadGeometry,
          segments,
          totalDistance: parseFloat(effectiveTotalDistance.toFixed(2)),
          totalStops: result.path.length - (returnToStart ? 1 : 0),
          returnToStart,
          estimatedTime: {
            minutes: estimatedMinutes,
            hours: estimatedHours,
          },
          estimatedCost: {
            fuel: parseFloat(fuelCost.toFixed(2)),
            currency: "USD",
          },
        },
        algorithm: {
          name: result.algorithm,
          executionTime: parseFloat(result.executionTime.toFixed(2)),
          iterations: result.iterations,
        },
        metadata: {
          requestedLocations: locationIds.length,
          optimizedRoute: result.path.length,
          improvementMetric: "Road Distance & Travel Time Minimized",
          matrixSource: travelMatrix.source,
          geometrySource: roadGeometry.source,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error optimizing route:", error);
    return NextResponse.json(
      { error: "Failed to optimize route" },
      { status: 500 }
    );
  }
}
