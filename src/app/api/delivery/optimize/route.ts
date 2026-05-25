import { NextRequest, NextResponse } from "next/server";
import { DeliveryStopInput, isValidPoint, optimizeDeliveryRoute } from "@/lib/delivery-routing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { depot, stops, startTime, vehicleType, costPerKm } = body;

    if (!depot || !isValidPoint(depot)) {
      return NextResponse.json(
        { error: "A valid depot/current location is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(stops) || stops.length === 0) {
      return NextResponse.json(
        { error: "At least one stop is required" },
        { status: 400 }
      );
    }

    const invalidStopIndex = stops.findIndex((stop: DeliveryStopInput) => !isValidPoint(stop));
    if (invalidStopIndex !== -1) {
      return NextResponse.json(
        { error: `Stop ${invalidStopIndex + 1} must include valid coordinates` },
        { status: 400 }
      );
    }

    const result = await optimizeDeliveryRoute({
      depot,
      stops,
      startTime,
      vehicleType,
      costPerKm,
    });

    return NextResponse.json({ success: true, route: result });
  } catch (error) {
    console.error("Delivery optimization error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to optimize delivery route" },
      { status: 500 }
    );
  }
}
