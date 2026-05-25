import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  DeliveryStopInput,
  GeoPoint,
  haversineDistanceKm,
  isValidPoint,
  normalizePriority,
  optimizeDeliveryRoute,
} from "@/lib/delivery-routing";

interface DriverInput {
  id: string;
  name?: string;
  depot?: GeoPoint;
  currentLocation?: GeoPoint;
  vehicleType?: string;
  capacity?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can run multi-driver assignment" }, { status: 403 });
    }

    const body = await request.json();
    const depot = body.depot as GeoPoint | undefined;
    const drivers = Array.isArray(body.drivers) ? (body.drivers as DriverInput[]) : [];
    const stops = Array.isArray(body.stops) ? (body.stops as DeliveryStopInput[]) : [];

    if (!depot || !isValidPoint(depot)) {
      return NextResponse.json({ error: "A valid depot is required" }, { status: 400 });
    }

    if (drivers.length === 0) {
      return NextResponse.json({ error: "At least one driver is required" }, { status: 400 });
    }

    if (stops.length === 0) {
      return NextResponse.json({ error: "At least one stop is required" }, { status: 400 });
    }

    for (const [index, stop] of stops.entries()) {
      if (!isValidPoint(stop)) {
        return NextResponse.json({ error: `Stop ${index + 1} has invalid coordinates` }, { status: 400 });
      }
    }

    const assignments = assignStopsToDrivers(depot, drivers, stops);
    const optimizedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const driverDepot = assignment.driver.currentLocation || assignment.driver.depot || depot;
        const route = assignment.stops.length
          ? await optimizeDeliveryRoute({
              depot: driverDepot,
              stops: assignment.stops,
              vehicleType: assignment.driver.vehicleType,
              startTime: body.startTime,
            })
          : null;

        return {
          driver: assignment.driver,
          stops: assignment.stops,
          route,
        };
      })
    );

    return NextResponse.json({
      assignments: optimizedAssignments,
      totals: {
        drivers: drivers.length,
        stops: stops.length,
        assignedStops: assignments.reduce((sum, assignment) => sum + assignment.stops.length, 0),
        totalDistanceKm: optimizedAssignments.reduce(
          (sum, assignment) => sum + (assignment.route?.totalDistanceKm || 0),
          0
        ),
        totalDurationMin: optimizedAssignments.reduce(
          (sum, assignment) => sum + (assignment.route?.totalDurationMin || 0),
          0
        ),
      },
    });
  } catch (error) {
    console.error("VRP assignment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to assign multi-driver routes" },
      { status: 500 }
    );
  }
}

function assignStopsToDrivers(depot: GeoPoint, drivers: DriverInput[], stops: DeliveryStopInput[]) {
  const assignments = drivers.map((driver) => ({
    driver,
    stops: [] as DeliveryStopInput[],
    cursor: driver.currentLocation || driver.depot || depot,
  }));

  const sortedStops = [...stops].sort((a, b) => {
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return (a.timeWindowStart || "99:99").localeCompare(b.timeWindowStart || "99:99");
  });

  for (const stop of sortedStops) {
    let selected = assignments[0];
    let selectedScore = Number.POSITIVE_INFINITY;

    for (const assignment of assignments) {
      const distance = haversineDistanceKm(assignment.cursor, stop);
      const loadPenalty = assignment.stops.length * 0.7;
      const score = distance + loadPenalty;

      if (score < selectedScore) {
        selectedScore = score;
        selected = assignment;
      }
    }

    selected.stops.push(stop);
    selected.cursor = stop;
  }

  return assignments.map(({ driver, stops }) => ({ driver, stops }));
}

function priorityRank(priority?: string): number {
  const normalized = normalizePriority(priority);
  if (normalized === "HIGH") return 0;
  if (normalized === "NORMAL") return 1;
  return 2;
}
