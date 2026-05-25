import { NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  importance?: number;
}

const NOMINATIM_URL =
  process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const queries = normalizeQueries(body);

    if (queries.length === 0) {
      return NextResponse.json(
        { error: "Provide an address or addresses to geocode" },
        { status: 400 }
      );
    }

    if (queries.length > 25) {
      return NextResponse.json(
        { error: "A maximum of 25 addresses can be geocoded at once" },
        { status: 400 }
      );
    }

    const results = [];
    for (const query of queries) {
      results.push(await geocodeOne(query));
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to geocode address" },
      { status: 500 }
    );
  }
}

function normalizeQueries(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];

  const value = body as { address?: unknown; query?: unknown; addresses?: unknown };
  if (typeof value.address === "string") return [value.address.trim()].filter(Boolean);
  if (typeof value.query === "string") return [value.query.trim()].filter(Boolean);
  if (Array.isArray(value.addresses)) {
    return value.addresses
      .filter((address): address is string => typeof address === "string")
      .map((address) => address.trim())
      .filter(Boolean);
  }

  return [];
}

async function geocodeOne(query: string) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
  });

  const countryCodes = process.env.NOMINATIM_COUNTRYCODES;
  if (countryCodes) {
    params.set("countrycodes", countryCodes);
  }

  const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    headers: {
      "User-Agent": process.env.NOMINATIM_USER_AGENT || "RouteSense/1.0",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  const data = (await response.json()) as NominatimResult[];
  const match = data[0];

  if (!match) {
    return {
      query,
      found: false,
      error: "Could not geocode address. Please check and retry.",
    };
  }

  return {
    query,
    found: true,
    address: match.display_name,
    lat: Number(match.lat),
    lng: Number(match.lon),
    type: match.type,
    importance: match.importance,
  };
}
