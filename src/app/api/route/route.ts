import { NextRequest, NextResponse } from "next/server";
import { GeoPoint, getRoadRouteGeometry, isValidPoint } from "@/lib/delivery-routing";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
