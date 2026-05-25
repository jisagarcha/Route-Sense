export type StopPriority = "HIGH" | "NORMAL" | "LOW";
export type StopStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface PlannerStop {
  id: string;
  address: string;
  resolvedAddress?: string;
  recipientName: string;
  notes: string;
  priority: StopPriority;
  timeWindowStart: string;
  timeWindowEnd: string;
  lat: number;
  lng: number;
  status: StopStatus;
  estimatedArrivalLabel?: string;
  etaMinutesFromStart?: number;
  legDistanceKm?: number;
  legDurationMin?: number;
}

export interface RouteGeometry {
  coordinates: Array<[number, number]>;
  distanceKm: number;
  durationMin: number;
  source: "osrm" | "fallback";
}

export interface OptimizedRoute {
  orderedStops: PlannerStop[];
  routeOrder: string[];
  geometry: RouteGeometry;
  totalDistanceKm: number;
  totalDurationMin: number;
  travelDurationMin: number;
  serviceDurationMin: number;
  fuelCost: number;
  algorithm: string;
  matrixSource: "osrm" | "fallback";
  routeSource: "osrm" | "fallback";
  executionTimeMs: number;
  violations: Array<{
    stopId: string;
    type: "TIME_WINDOW" | "PRIORITY";
    message: string;
  }>;
}

export interface DeliveryHistoryEntry {
  id: string;
  completedAt: string;
  totalDistanceKm: number;
  totalDurationMin: number;
  stopsCompleted: number;
  fuelCost: number;
  routeSource: string;
}
