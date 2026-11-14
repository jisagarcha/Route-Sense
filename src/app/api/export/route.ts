/**
 * CSV Export API
 * GET /api/export?type=locations|roads|deliveries|items|drivers
 * Exports operational and BI data in CSV format
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { arrayToCSV } from "@/lib/csv-utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const validExportTypes = ["locations", "roads", "deliveries", "items", "drivers"];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "ANALYST" && role !== "DISPATCHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!type || !validExportTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validExportTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const dateStamp = new Date().toISOString().split("T")[0];

    // 1. Deliveries & Route Variance
    if (type === "deliveries") {
      const packages = await prisma.package.findMany({
        include: {
          dispatcher: { select: { name: true, email: true } },
          driver: { select: { name: true, email: true } },
          items: { select: { id: true } },
          delivery: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const csvData = packages.map((pkg) => {
        const estMin = pkg.estimatedDuration ?? null;
        const actMin = pkg.delivery?.actualTime ?? null;
        const varianceMin = estMin !== null && actMin !== null ? actMin - estMin : "";

        return {
          packageId: pkg.id,
          packageName: pkg.packageName,
          status: pkg.status,
          priority: pkg.priority,
          dispatcher: pkg.dispatcher?.name || pkg.dispatcher?.email || "Unknown",
          driver: pkg.driver?.name || pkg.driver?.email || "Unassigned",
          stopsCount: pkg.items.length,
          totalWeightKg: pkg.totalWeight,
          totalDistanceKm: pkg.totalDistance !== null ? pkg.totalDistance.toFixed(2) : "",
          estimatedDurationMin: estMin !== null ? estMin : "",
          actualDurationMin: actMin !== null ? actMin : "",
          varianceMin: varianceMin !== "" ? varianceMin : "",
          startedAt: pkg.delivery?.startedAt ? pkg.delivery.startedAt.toISOString() : "",
          completedAt: pkg.deliveredAt ? pkg.deliveredAt.toISOString() : "",
          failureReason: pkg.failureReason || "",
        };
      });

      const csv = arrayToCSV(csvData, [
        "packageId",
        "packageName",
        "status",
        "priority",
        "dispatcher",
        "driver",
        "stopsCount",
        "totalWeightKg",
        "totalDistanceKm",
        "estimatedDurationMin",
        "actualDurationMin",
        "varianceMin",
        "startedAt",
        "completedAt",
        "failureReason",
      ]);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="delivery_routes_${dateStamp}.csv"`,
        },
      });
    }

    // 2. Item Stops & Return Diagnostics
    if (type === "items") {
      const items = await prisma.packageItem.findMany({
        include: {
          package: { select: { packageName: true, status: true } },
          product: { select: { name: true, weight: true, volumeCubicFt: true } },
        },
        orderBy: [{ packageId: "asc" }, { sequence: "asc" }],
      });

      const csvData = items.map((item) => ({
        itemId: item.id,
        packageName: item.package?.packageName || "",
        productName: item.product?.name || "",
        quantity: item.quantity,
        totalWeightKg: (item.product?.weight || 0) * item.quantity,
        recipientName: item.recipientName || "",
        recipientPhone: item.recipientPhone || "",
        deliveryAddress: item.deliveryAddress || "",
        latitude: item.deliveryLat ?? "",
        longitude: item.deliveryLong ?? "",
        sequence: item.sequence ?? "",
        deliveryStatus: item.deliveryStatus,
        failureReason: item.failureReason || "",
        collectedAt: item.collectedAt ? item.collectedAt.toISOString() : "",
        deliveredAt: item.deliveredAt ? item.deliveredAt.toISOString() : "",
      }));

      const csv = arrayToCSV(csvData, [
        "itemId",
        "packageName",
        "productName",
        "quantity",
        "totalWeightKg",
        "recipientName",
        "recipientPhone",
        "deliveryAddress",
        "latitude",
        "longitude",
        "sequence",
        "deliveryStatus",
        "failureReason",
        "collectedAt",
        "deliveredAt",
      ]);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="delivery_items_diagnostics_${dateStamp}.csv"`,
        },
      });
    }

    // 3. Driver Fleet Utilization & Performance
    if (type === "drivers") {
      const drivers = await prisma.user.findMany({
        where: { role: "DRIVER" },
        include: {
          driverProfile: true,
          _count: {
            select: {
              driverPackages: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const csvData = drivers.map((d) => ({
        driverId: d.id,
        name: d.name || "",
        email: d.email,
        vehicleType: d.driverProfile?.vehicleType || "Unspecified",
        maxCapacityKg: d.driverProfile?.maxCapacity ?? "",
        maxVolumeCuFt: d.driverProfile?.maxVolume ?? "",
        rating: d.driverProfile?.rating ?? "",
        experienceYears: d.driverProfile?.experienceYears ?? "",
        totalDeliveries: d.driverProfile?.totalDeliveries ?? 0,
        isAvailable: d.driverProfile?.isAvailable ? "YES" : "NO",
        assignedPackagesCount: d._count.driverPackages,
      }));

      const csv = arrayToCSV(csvData, [
        "driverId",
        "name",
        "email",
        "vehicleType",
        "maxCapacityKg",
        "maxVolumeCuFt",
        "rating",
        "experienceYears",
        "totalDeliveries",
        "isAvailable",
        "assignedPackagesCount",
      ]);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="driver_fleet_${dateStamp}.csv"`,
        },
      });
    }

    // 4. Locations
    if (type === "locations") {
      const locations = await prisma.location.findMany({
        orderBy: { name: "asc" },
        select: {
          name: true,
          description: true,
          latitude: true,
          longitude: true,
        },
      });

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
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="locations_${dateStamp}.csv"`,
        },
      });
    }

    // 5. Roads
    if (type === "roads") {
      const roads = await prisma.road.findMany({
        orderBy: [{ fromLocationId: "asc" }, { toLocationId: "asc" }],
        include: {
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
        },
      });

      const csvData = roads.map((road) => ({
        fromLocation: road.fromLocation.name,
        toLocation: road.toLocation.name,
        distance: road.distance,
        isBidirectional: road.isBidirectional ? "YES" : "NO",
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
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="roads_${dateStamp}.csv"`,
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
