import { NextRequest, NextResponse } from "next/server";
import { GeoPoint, getRoadRouteGeometry, isValidPoint } from "@/lib/delivery-routing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const points = Array.isArray(body.points) ? (body.points as GeoPoint[]) : [];

    if (points.length < 2) {
      return NextResponse.json(
        { error: "At least two points are required" },
        { status: 400 }
      );
    }

    const invalidPointIndex = points.findIndex((point) => !isValidPoint(point));
    if (invalidPointIndex !== -1) {
      return NextResponse.json(
        { error: `Point ${invalidPointIndex + 1} has invalid coordinates` },
        { status: 400 }
      );
    }

    const route = await getRoadRouteGeometry(points);
    return NextResponse.json({ route });
  } catch (error) {
    console.error("Route geometry error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to calculate route" },
      { status: 500 }
    );
  }
}
