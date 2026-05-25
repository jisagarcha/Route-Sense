import {
  GeoPoint,
  haversineDistanceKm,
  optimizeDeliveryRoute,
  type DeliveryPriority,
} from "@/lib/delivery-routing";

export interface Stop {
  id: string;
  lat: number;
  lng: number;
  priority: DeliveryPriority;
  timeWindowStart?: Date;
  timeWindowEnd?: Date;
  address: string;
}

export interface RouteResult {
  orderedStops: Stop[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  polyline: [number, number][];
  estimatedArrivals: { stopId: string; eta: Date }[];
  warnings: string[];
}

export async function optimizeRoute(
  depot: GeoPoint,
  stops: Stop[],
  dispatchTime?: Date
): Promise<RouteResult> {
  if (!Number.isFinite(depot.lat) || !Number.isFinite(depot.lng)) {
    throw new Error("Depot must include valid latitude and longitude");
  }

  if (!Array.isArray(stops) || stops.length === 0) {
    throw new Error("At least one stop is required");
  }

  const normalizedStops = stops.map((stop, index) => {
    if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) {
      throw new Error(`Stop ${index + 1} has invalid coordinates`);
    }

    return {
      ...stop,
      address: stop.address || `Stop ${index + 1}`,
      priority: normalizePriority(stop.priority),
    };
  });

  const route = await optimizeDeliveryRoute({
    depot,
    stops: normalizedStops.map((stop) => ({
      id: stop.id,
      lat: stop.lat,
      lng: stop.lng,
      address: stop.address,
      priority: stop.priority,
      timeWindowStart: toTimeInput(stop.timeWindowStart),
      timeWindowEnd: toTimeInput(stop.timeWindowEnd),
      serviceTimeMin: 5,
    })),
    startTime: dispatchTime?.toISOString(),
  });

  const stopById = new Map(normalizedStops.map((stop) => [stop.id, stop]));
  const orderedStops = route.orderedStops.map((stop) => {
    const original = stopById.get(stop.id);
    return {
      id: stop.id,
      lat: stop.lat,
      lng: stop.lng,
      priority: normalizePriority(original?.priority || stop.priority),
      timeWindowStart: original?.timeWindowStart,
      timeWindowEnd: original?.timeWindowEnd,
      address: original?.address || stop.address,
    };
  });

  const warnings = route.violations.map((violation) => violation.message);
  if (route.matrixSource === "fallback") {
    warnings.push("OSRM distance matrix unavailable; used Haversine fallback.");
  }
  if (route.routeSource === "fallback") {
    warnings.push("OSRM road geometry unavailable; drew straight-line route.");
  }

  return {
    orderedStops,
    totalDistanceKm: route.totalDistanceKm,
    totalDurationMinutes: route.totalDurationMin,
    polyline: route.geometry.coordinates,
    estimatedArrivals: route.orderedStops.map((stop) => ({
      stopId: stop.id,
      eta: new Date(stop.estimatedArrival),
    })),
    warnings,
  };
}

export function distanceKm(a: GeoPoint, b: GeoPoint) {
  return haversineDistanceKm(a, b);
}

function normalizePriority(priority?: string): DeliveryPriority {
  if (priority === "HIGH") return "HIGH";
  if (priority === "LOW") return "LOW";
  return "NORMAL";
}

function toTimeInput(value?: Date): string | null {
  if (!value) return null;
  return `${value.getHours().toString().padStart(2, "0")}:${value
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}
