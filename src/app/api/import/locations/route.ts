/**
 * CSV Import API for Locations
 * POST /api/import/locations
 * Handles bulk location import from CSV files
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCSV,
  validateLocationCSV,
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

    // Validate data
    const validation = validateLocationCSV(parsedData);

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

    // Check for duplicates in database
    const locationNames = parsedData.map((row) => String(row.name).trim());
    const existingLocations = await prisma.location.findMany({
      where: {
        name: {
          in: locationNames,
        },
      },
      select: {
        name: true,
      },
    });

    const existingNames = new Set(existingLocations.map((loc) => loc.name));
    const duplicates: string[] = [];
    const toImport: Array<{
      name: string;
      description: string | null;
      latitude: number;
      longitude: number;
    }> = [];

    // Filter duplicates
    parsedData.forEach((row) => {
      const name = String(row.name).trim();
      if (existingNames.has(name)) {
        duplicates.push(name);
        if (!skipDuplicates) {
          toImport.push({
            name,
            description: row.description ? String(row.description).trim() : null,
            latitude: parseFloat(String(row.latitude)),
            longitude: parseFloat(String(row.longitude)),
          });
        }
      } else {
        toImport.push({
          name,
          description: row.description ? String(row.description).trim() : null,
          latitude: parseFloat(String(row.latitude)),
          longitude: parseFloat(String(row.longitude)),
        });
      }
    });

    // Import locations
    let imported = 0;
    let skipped = 0;

    if (toImport.length > 0) {
      if (skipDuplicates) {
        // Use createMany (faster, but skips duplicates)
        const result = await prisma.location.createMany({
          data: toImport,
          skipDuplicates: true,
        });
        imported = result.count;
        skipped = duplicates.length;
      } else {
        // Update existing, create new (upsert)
        for (const location of toImport) {
          await prisma.location.upsert({
            where: { name: location.name },
            update: {
              description: location.description,
              latitude: location.latitude,
              longitude: location.longitude,
            },
            create: location,
          });
          imported++;
        }
      }
    } else {
      skipped = duplicates.length;
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
    console.error("Location import error:", error);
    return NextResponse.json(
      {
        error: "Failed to import locations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
