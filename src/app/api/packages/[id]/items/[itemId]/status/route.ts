import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set(["COLLECTED_FROM_WAREHOUSE", "DELIVERED", "FAILED"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: packageId, itemId } = await params;
    const body = await req.json();
    const status = String(body.status || "").toUpperCase();

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Invalid item status" }, { status: 400 });
    }

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        delivery: true,
        items: { include: { product: true }, orderBy: { sequence: "asc" } },
      },
    });

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const isAssignedDriver = pkg.driverId === session.user.id;
    const canUpdate =
      session.user.role === "ADMIN" ||
      session.user.role === "DISPATCHER" ||
      (session.user.role === "DRIVER" && isAssignedDriver);

    if (!canUpdate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.role === "DRIVER" && !["COLLECTED_FROM_WAREHOUSE", "IN_TRANSIT"].includes(pkg.status)) {
      return NextResponse.json({ error: "Package is not ready for item delivery" }, { status: 403 });
    }

    const item = pkg.items.find((entry) => entry.id === itemId);
    if (!item) {
      return NextResponse.json({ error: "Package item not found" }, { status: 404 });
    }

    const timestamp = parseTimestamp(body.timestamp);

    await prisma.packageItem.update({
      where: { id: itemId },
      data: {
        deliveryStatus: status,
        collectedAt: status === "COLLECTED_FROM_WAREHOUSE" ? timestamp : item.collectedAt,
        deliveredAt: status === "DELIVERED" || status === "FAILED" ? timestamp : item.deliveredAt,
        failureReason:
          status === "FAILED"
            ? typeof body.failureReason === "string" && body.failureReason.trim()
              ? body.failureReason.trim()
              : "Unspecified"
            : null,
      },
    });

    const refreshedItems = await prisma.packageItem.findMany({
      where: { packageId },
      orderBy: { sequence: "asc" },
    });

    const hasPendingItems = refreshedItems.some((entry) => !["DELIVERED", "FAILED"].includes(entry.deliveryStatus));
    const hasFailedItems = refreshedItems.some((entry) => entry.deliveryStatus === "FAILED");

    if (!hasPendingItems) {
      const completedStatus = hasFailedItems ? "FAILED" : "DELIVERED";
      const completedData: Record<string, unknown> = {
        status: completedStatus,
        deliveredAt: timestamp,
        failureReason: hasFailedItems ? "One or more delivery stops failed." : null,
      };

      const startedAt = pkg.delivery?.startedAt;
      const actualTime = startedAt
        ? Math.max(0, Math.round((timestamp.getTime() - startedAt.getTime()) / 60000))
        : null;

      await prisma.$transaction([
        prisma.package.update({
          where: { id: packageId },
          data: completedData,
        }),
        prisma.delivery.upsert({
          where: { packageId },
          update: {
            status: hasFailedItems ? "FAILED" : "COMPLETED",
            completedAt: timestamp,
            actualTime,
          },
          create: {
            packageId,
            status: hasFailedItems ? "FAILED" : "COMPLETED",
            completedAt: timestamp,
            actualTime,
          },
        }),
        prisma.driverProfile.updateMany({
          where: { userId: session.user.id },
          data: { isAvailable: true, totalDeliveries: { increment: 1 } },
        }),
      ]);
    }

    const updatedPackage = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        dispatcher: { select: { id: true, name: true, email: true } },
        driver: { select: { id: true, name: true, email: true } },
        route: true,
        delivery: true,
        items: {
          include: { product: true },
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json({
      message: "Item delivery status updated successfully",
      package: updatedPackage,
      itemId,
      status,
    });
  } catch (error) {
    console.error("Error updating item delivery status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update item status" },
      { status: 500 }
    );
  }
}

function parseTimestamp(value: unknown) {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}
