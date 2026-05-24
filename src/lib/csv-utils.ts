/**
 * CSV Import/Export Utilities
 * Handles conversion between database records and CSV format
 */

export interface CSVLocation {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
}

export interface CSVRoad {
  fromLocation: string;
  toLocation: string;
  distance: number;
  isBidirectional: boolean;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Parse CSV string into array of objects
 */
export function parseCSV<T>(csvString: string): T[] {
  const lines = csvString.trim().split("\n");
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const data: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue; // Skip empty lines

    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    data.push(row as T);
  }

  return data;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Convert array of objects to CSV string
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  headers?: string[]
): string {
  if (data.length === 0) return "";

  const keys = headers || Object.keys(data[0]);
  const csvRows: string[] = [];

  // Add headers
  csvRows.push(keys.join(","));

  // Add data rows
  data.forEach((row) => {
    const values = keys.map((key) => {
      const value = row[key];
      // Handle null/undefined
      if (value === null || value === undefined) return "";
      // Escape commas and quotes
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(","));
  });

  return csvRows.join("\n");
}

/**
 * Validate location CSV data
 */
export function validateLocationCSV(
  data: Record<string, unknown>[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 because index 0 is headers, and CSV rows start at 1

    // Validate name (required)
    if (!row.name || String(row.name).trim() === "") {
      errors.push({
        row: rowNum,
        field: "name",
        message: "Name is required",
        value: row.name,
      });
    }

    // Validate latitude (required, must be number between -90 and 90)
    const lat = parseFloat(String(row.latitude || ""));
    if (isNaN(lat)) {
      errors.push({
        row: rowNum,
        field: "latitude",
        message: "Latitude must be a valid number",
        value: row.latitude,
      });
    } else if (lat < -90 || lat > 90) {
      errors.push({
        row: rowNum,
        field: "latitude",
        message: "Latitude must be between -90 and 90",
        value: lat,
      });
    }

    // Validate longitude (required, must be number between -180 and 180)
    const lng = parseFloat(String(row.longitude || ""));
    if (isNaN(lng)) {
      errors.push({
        row: rowNum,
        field: "longitude",
        message: "Longitude must be a valid number",
        value: row.longitude,
      });
    } else if (lng < -180 || lng > 180) {
      errors.push({
        row: rowNum,
        field: "longitude",
        message: "Longitude must be between -180 and 180",
        value: lng,
      });
    }

    // Warn if description is missing
    if (!row.description || String(row.description).trim() === "") {
      warnings.push(`Row ${rowNum}: Description is empty`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate road CSV data
 */
export function validateRoadCSV(
  data: Record<string, unknown>[],
  existingLocationNames: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const locationSet = new Set(existingLocationNames.map((n) => n.toLowerCase()));

  data.forEach((row, index) => {
    const rowNum = index + 2;

    // Validate fromLocation (required, must exist)
    if (!row.fromLocation || String(row.fromLocation).trim() === "") {
      errors.push({
        row: rowNum,
        field: "fromLocation",
        message: "From location is required",
        value: row.fromLocation,
      });
    } else if (!locationSet.has(String(row.fromLocation).trim().toLowerCase())) {
      errors.push({
        row: rowNum,
        field: "fromLocation",
        message: "From location does not exist in database",
        value: row.fromLocation,
      });
    }

    // Validate toLocation (required, must exist)
    if (!row.toLocation || String(row.toLocation).trim() === "") {
      errors.push({
        row: rowNum,
        field: "toLocation",
        message: "To location is required",
        value: row.toLocation,
      });
    } else if (!locationSet.has(String(row.toLocation).trim().toLowerCase())) {
      errors.push({
        row: rowNum,
        field: "toLocation",
        message: "To location does not exist in database",
        value: row.toLocation,
      });
    }

    // Check if from and to are the same
    if (
      row.fromLocation &&
      row.toLocation &&
      String(row.fromLocation).toLowerCase() === String(row.toLocation).toLowerCase()
    ) {
      errors.push({
        row: rowNum,
        field: "fromLocation",
        message: "From and To locations cannot be the same",
        value: row.fromLocation,
      });
    }

    // Validate distance (required, must be positive number)
    const distance = parseFloat(String(row.distance || ""));
    if (isNaN(distance)) {
      errors.push({
        row: rowNum,
        field: "distance",
        message: "Distance must be a valid number",
        value: row.distance,
      });
    } else if (distance <= 0) {
      errors.push({
        row: rowNum,
        field: "distance",
        message: "Distance must be greater than 0",
        value: distance,
      });
    }

    // Validate isBidirectional (optional, must be boolean)
    if (row.isBidirectional !== undefined) {
      const isBidi = String(row.isBidirectional).toLowerCase();
      if (!["true", "false", "yes", "no", "1", "0"].includes(isBidi)) {
        errors.push({
          row: rowNum,
          field: "isBidirectional",
          message: "isBidirectional must be true/false, yes/no, or 1/0",
          value: row.isBidirectional,
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Convert boolean-like values to actual boolean
 */
export function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase().trim();
  return ["true", "yes", "1"].includes(str);
}

/**
 * Download data as CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

/**
 * Get CSV template for locations
 */
export function getLocationCSVTemplate(): string {
  return "name,description,latitude,longitude\n" +
    "Central Hub,Main distribution center,27.7172,85.3240\n" +
    "North Station,Northern delivery point,27.7350,85.3320\n" +
    "South Depot,Southern warehouse,27.6990,85.3150";
}

/**
 * Get CSV template for roads
 */
export function getRoadCSVTemplate(): string {
  return "fromLocation,toLocation,distance,isBidirectional\n" +
    "Central Hub,North Station,5.2,true\n" +
    "Central Hub,South Depot,3.8,true\n" +
    "North Station,South Depot,7.5,false";
}
