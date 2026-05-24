/**
 * CSV Import API for Roads
 * POST /api/import/roads
 * Handles bulk road network import from CSV files
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCSV,
  validateRoadCSV,
  parseBoolean,
  type ValidationResult,
} from "@/lib/csv-utils";

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ValidationResult["errors"];
  warnings: string[];
  duplicates: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { csvData, skipDuplicates = true } = body;

    if (!csvData || typeof csvData !== "string") {
      return NextResponse.json(
        { error: "CSV data is required" },
        { status: 400 }
      );
    }

    // Parse CSV
    const parsedData = parseCSV<Record<string, unknown>>(csvData);

    if (parsedData.length === 0) {
      return NextResponse.json(
        { error: "No data found in CSV file" },
        { status: 400 }
      );
    }

    // Get all existing locations for validation
    const existingLocations = await prisma.location.findMany({
      select: { id: true, name: true },
    });

    const locationMap = new Map(
      existingLocations.map((loc) => [loc.name.toLowerCase(), loc.id])
    );

    // Validate data
    const validation = validateRoadCSV(
      parsedData,
      Array.from(locationMap.keys())
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 422 }
      );
    }

    // Check for existing roads
    const existingRoads = await prisma.road.findMany({
      include: {
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
      },
    });

    const existingRoadKeys = new Set(
      existingRoads.map((road) =>
        `${road.fromLocation.name.toLowerCase()}-${road.toLocation.name.toLowerCase()}`
      )
    );

    const duplicates: string[] = [];
    const toImport: Array<{
      fromLocationId: number;
      toLocationId: number;
      distance: number;
      isBidirectional: boolean;
    }> = [];

    // Process roads
    parsedData.forEach((row) => {
      const fromName = String(row.fromLocation).trim();
      const toName = String(row.toLocation).trim();
      const fromId = locationMap.get(fromName.toLowerCase());
      const toId = locationMap.get(toName.toLowerCase());

      if (!fromId || !toId) {
        // Should not happen due to validation, but just in case
        return;
      }

      const roadKey = `${fromName.toLowerCase()}-${toName.toLowerCase()}`;
      const isExisting = existingRoadKeys.has(roadKey);

      if (isExisting) {
        duplicates.push(`${fromName} -> ${toName}`);
        if (skipDuplicates) {
          return;
        }
      }

      toImport.push({
        fromLocationId: fromId,
        toLocationId: toId,
        distance: parseFloat(String(row.distance)),
        isBidirectional: row.isBidirectional
          ? parseBoolean(row.isBidirectional)
          : false,
      });
    });

    // Import roads
    let imported = 0;
    let skipped = duplicates.length;

    if (toImport.length > 0) {
      if (skipDuplicates) {
        // Use createMany (faster, but skips duplicates)
        try {
          const result = await prisma.road.createMany({
            data: toImport,
            skipDuplicates: false, // We already filtered duplicates
          });
          imported = result.count;
        } catch (error) {
          // Handle potential unique constraint violations
          console.warn("Some roads may already exist:", error);
          // Try one by one
          for (const road of toImport) {
            try {
              await prisma.road.create({ data: road });
              imported++;
            } catch {
              skipped++;
            }
          }
        }
      } else {
        // Update existing, create new
        for (const road of toImport) {
          try {
            // Check if road exists
            const existing = await prisma.road.findFirst({
              where: {
                fromLocationId: road.fromLocationId,
                toLocationId: road.toLocationId,
              },
            });

            if (existing) {
              // Update existing road
              await prisma.road.update({
                where: { id: existing.id },
                data: {
                  distance: road.distance,
                  isBidirectional: road.isBidirectional,
                },
              });
            } else {
              // Create new road
              await prisma.road.create({ data: road });
            }
            imported++;
          } catch (error) {
            console.error("Error importing road:", error);
            skipped++;
          }
        }
      }
    }

    const result: ImportResult = {
      success: true,
      imported,
      skipped,
      errors: [],
      warnings: validation.warnings,
      duplicates,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Road import error:", error);
    return NextResponse.json(
      {
        error: "Failed to import roads",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
