/**
 * CSV Export API
 * GET /api/export?type=locations|roads
 * Exports data as CSV format
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { arrayToCSV } from "@/lib/csv-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!type || !["locations", "roads"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'locations' or 'roads'" },
        { status: 400 }
      );
    }

    if (type === "locations") {
      // Export locations
      const locations = await prisma.location.findMany({
        orderBy: { name: "asc" },
        select: {
          name: true,
          description: true,
          latitude: true,
          longitude: true,
        },
      });

      if (locations.length === 0) {
        return NextResponse.json(
          { error: "No locations found to export" },
          { status: 404 }
        );
      }

      // Convert to CSV format
      const csvData = locations.map((loc) => ({
        name: loc.name,
        description: loc.description || "",
        latitude: loc.latitude || "",
        longitude: loc.longitude || "",
      }));

      const csv = arrayToCSV(csvData, [
        "name",
        "description",
        "latitude",
        "longitude",
      ]);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="locations_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } else if (type === "roads") {
      // Export roads
      const roads = await prisma.road.findMany({
        orderBy: [{ fromLocationId: "asc" }, { toLocationId: "asc" }],
        include: {
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
        },
      });

      if (roads.length === 0) {
        return NextResponse.json(
          { error: "No roads found to export" },
          { status: 404 }
        );
      }

      // Convert to CSV format
      const csvData = roads.map((road) => ({
        fromLocation: road.fromLocation.name,
        toLocation: road.toLocation.name,
        distance: road.distance,
        isBidirectional: road.isBidirectional,
      }));

      const csv = arrayToCSV(csvData, [
        "fromLocation",
        "toLocation",
        "distance",
        "isBidirectional",
      ]);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="roads_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      {
        error: "Failed to export data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
