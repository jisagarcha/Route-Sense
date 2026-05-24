import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/routing-engine";
import {
  buildDistanceMatrix,
  solveTSP,
  TSPLocation,
} from "@/lib/tsp-solver";

export async function POST(request: NextRequest) {
  try {
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
      (loc) => !loc.latitude || !loc.longitude
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

    // Build distance matrix
    const distanceMatrix = buildDistanceMatrix(
      tspLocations,
      (loc1, loc2) =>
        haversineDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude)
    );

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
        distance: distanceMatrix[fromId][toId],
      });
    }

    // Estimate time (assuming 30 km/h average speed)
    const avgSpeed = 30; // km/h
    const estimatedHours = result.totalDistance / avgSpeed;
    const estimatedMinutes = Math.round(estimatedHours * 60);

    // Calculate fuel cost (assuming 10 km/l and $1.5/liter)
    const fuelEfficiency = 10; // km/l
    const fuelPrice = 1.5; // $/liter
    const fuelCost = (result.totalDistance / fuelEfficiency) * fuelPrice;

    return NextResponse.json(
      {
        success: true,
        optimization: {
          path: pathWithDetails,
          segments,
          totalDistance: parseFloat(result.totalDistance.toFixed(2)),
          totalStops: result.path.length - (returnToStart ? 1 : 0),
          returnToStart,
          estimatedTime: {
            minutes: estimatedMinutes,
            hours: parseFloat(estimatedHours.toFixed(2)),
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
          improvementMetric: "Total Distance Minimized",
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
