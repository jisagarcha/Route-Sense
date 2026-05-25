export type DeliveryPriority = "HIGH" | "NORMAL" | "LOW";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DeliveryStopInput extends GeoPoint {
  id: string;
  address: string;
  recipientName?: string;
  notes?: string;
  priority?: DeliveryPriority | string;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  serviceTimeMin?: number;
}

export interface DeliveryStopOutput extends DeliveryStopInput {
  sequence: number;
  priority: DeliveryPriority;
  estimatedArrival: string;
  estimatedArrivalLabel: string;
  etaMinutesFromStart: number;
  legDistanceKm: number;
  legDurationMin: number;
}

export interface DeliveryRouteViolation {
  stopId: string;
  type: "TIME_WINDOW" | "PRIORITY";
  message: string;
}

export interface RouteGeometryResult {
  coordinates: Array<[number, number]>;
  distanceKm: number;
  durationMin: number;
  source: "osrm" | "fallback";
}

export interface DeliveryOptimizationResult {
  orderedStops: DeliveryStopOutput[];
  routeOrder: string[];
  geometry: RouteGeometryResult;
  depot: GeoPoint;
  totalDistanceKm: number;
  totalDurationMin: number;
  travelDurationMin: number;
  serviceDurationMin: number;
  fuelCost: number;
  algorithm: string;
  matrixSource: "osrm" | "fallback";
  routeSource: "osrm" | "fallback";
  executionTimeMs: number;
  violations: DeliveryRouteViolation[];
}

interface MatrixResult {
  durationsSec: number[][];
  distancesM: number[][];
  source: "osrm" | "fallback";
}

interface OptimizeOptions {
  depot: GeoPoint;
  stops: DeliveryStopInput[];
  startTime?: string;
  vehicleType?: string;
  costPerKm?: number;
  osrmBaseUrl?: string;
}

const DEFAULT_OSRM_URL = "https://router.project-osrm.org";
const DEFAULT_AVG_SPEED_KPH = 32;
const DEFAULT_SERVICE_TIME_MIN = 4;
const TWO_OPT_ITERATIONS = 10;

export function normalizePriority(priority?: string): DeliveryPriority {
  const normalized = (priority || "NORMAL").toUpperCase();
  if (normalized === "HIGH") return "HIGH";
  if (normalized === "LOW") return "LOW";
  return "NORMAL";
}

export function isValidPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export async function optimizeDeliveryRoute({
  depot,
  stops,
  startTime,
  vehicleType = "motorbike",
  costPerKm,
  osrmBaseUrl = process.env.OSRM_BASE_URL || DEFAULT_OSRM_URL,
}: OptimizeOptions): Promise<DeliveryOptimizationResult> {
  const startedAt = performance.now();

  if (!isValidPoint(depot)) {
    throw new Error("Depot must include valid latitude and longitude");
  }

  if (!Array.isArray(stops) || stops.length === 0) {
    throw new Error("At least one delivery stop is required");
  }

  if (stops.length > 75) {
    throw new Error("A maximum of 75 stops can be optimized at once");
  }

  const normalizedStops = stops.map((stop, index) => {
    if (!stop.id) {
      throw new Error(`Stop ${index + 1} is missing an id`);
    }

    if (!isValidPoint(stop)) {
      throw new Error(`Stop ${index + 1} has invalid coordinates`);
    }

    return {
      ...stop,
      address: stop.address || `Stop ${index + 1}`,
      priority: normalizePriority(stop.priority),
      serviceTimeMin: stop.serviceTimeMin ?? DEFAULT_SERVICE_TIME_MIN,
    };
  });

  const points: GeoPoint[] = [depot, ...normalizedStops];
  const matrix = await buildTravelMatrix(points, osrmBaseUrl);
  const routePath = solvePriorityTsp(normalizedStops, matrix);
  const schedule = buildSchedule(routePath, normalizedStops, matrix, startTime);
  const orderedPoints = routePath.map((index) => points[index]);
  const geometry = await getRouteGeometry(orderedPoints, osrmBaseUrl);
  const travelDurationMin = getPathDurationMin(routePath, matrix);
  const serviceDurationMin = normalizedStops.reduce(
    (sum, stop) => sum + (stop.serviceTimeMin ?? DEFAULT_SERVICE_TIME_MIN),
    0
  );
  const totalDistanceKm = getPathDistanceKm(routePath, matrix);
  const totalDurationMin = Math.round(travelDurationMin + serviceDurationMin);
  const fuelCost = totalDistanceKm * getVehicleCostPerKm(vehicleType, costPerKm);
  const executionTimeMs = Math.round(performance.now() - startedAt);

  return {
    orderedStops: schedule.orderedStops,
    routeOrder: schedule.orderedStops.map((stop) => stop.id),
    geometry,
    depot,
    totalDistanceKm: round(totalDistanceKm, 2),
    totalDurationMin,
    travelDurationMin: Math.round(travelDurationMin),
    serviceDurationMin,
    fuelCost: round(fuelCost, 2),
    algorithm: "Priority nearest-neighbor + 2-opt",
    matrixSource: matrix.source,
    routeSource: geometry.source,
    executionTimeMs,
    violations: schedule.violations,
  };
}

export async function getRoadRouteGeometry(
  points: GeoPoint[],
  osrmBaseUrl = process.env.OSRM_BASE_URL || DEFAULT_OSRM_URL
): Promise<RouteGeometryResult> {
  return getRouteGeometry(points, osrmBaseUrl);
}

async function buildTravelMatrix(
  points: GeoPoint[],
  osrmBaseUrl: string
): Promise<MatrixResult> {
  try {
    const coords = points.map((point) => `${point.lng},${point.lat}`).join(";");
    const url = `${osrmBaseUrl}/table/v1/driving/${coords}?annotations=duration,distance`;
    const response = await fetchWithTimeout(url, 4500);

    if (!response.ok) {
      throw new Error(`OSRM table returned ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.durations) || !Array.isArray(data.distances)) {
      throw new Error("OSRM table response is missing matrix annotations");
    }

    return {
      durationsSec: data.durations,
      distancesM: data.distances,
      source: "osrm",
    };
  } catch (error) {
    console.warn("Falling back to Haversine matrix:", error);
    return buildFallbackMatrix(points);
  }
}

function buildFallbackMatrix(points: GeoPoint[]): MatrixResult {
  const durationsSec: number[][] = [];
  const distancesM: number[][] = [];

  for (let i = 0; i < points.length; i++) {
    durationsSec[i] = [];
    distancesM[i] = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) {
        durationsSec[i][j] = 0;
        distancesM[i][j] = 0;
        continue;
      }

      const distanceKm = haversineDistanceKm(points[i], points[j]);
      const paddedRoadDistanceKm = distanceKm * 1.25;
      distancesM[i][j] = paddedRoadDistanceKm * 1000;
      durationsSec[i][j] = (paddedRoadDistanceKm / DEFAULT_AVG_SPEED_KPH) * 3600;
    }
  }

  return { durationsSec, distancesM, source: "fallback" };
}

function solvePriorityTsp(stops: Array<DeliveryStopInput & { priority: DeliveryPriority }>, matrix: MatrixResult): number[] {
  let path = nearestNeighborWithPriority(stops, matrix);
  let bestScore = routeObjective(path, stops, matrix);

  for (let iteration = 0; iteration < TWO_OPT_ITERATIONS; iteration++) {
    let improved = false;

    for (let i = 1; i < path.length - 2; i++) {
      for (let j = i + 1; j < path.length - 1; j++) {
        const candidate = [
          ...path.slice(0, i),
          ...path.slice(i, j + 1).reverse(),
          ...path.slice(j + 1),
        ];
        const score = routeObjective(candidate, stops, matrix);

        if (score + 0.001 < bestScore) {
          path = candidate;
          bestScore = score;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return path;
}

function nearestNeighborWithPriority(
  stops: Array<DeliveryStopInput & { priority: DeliveryPriority }>,
  matrix: MatrixResult
): number[] {
  const unvisited = new Set(stops.map((_, index) => index + 1));
  const path = [0];
  let current = 0;
  const frontHalfLimit = Math.ceil(stops.length / 2);

  while (unvisited.size > 0) {
    const visitedStops = path.length - 1;
    const highPriorityCandidates = [...unvisited].filter(
      (index) => stops[index - 1].priority === "HIGH"
    );
    const candidates =
      highPriorityCandidates.length > 0 && visitedStops < frontHalfLimit
        ? highPriorityCandidates
        : [...unvisited];

    let bestIndex = candidates[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const stop = stops[candidate - 1];
      const priorityPenalty = getPriorityRank(stop.priority) * 60;
      const areaPenalty = recentlyVisitedAreaPenalty(candidate, path, stops);
      const score = matrix.durationsSec[current][candidate] + priorityPenalty + areaPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = candidate;
      }
    }

    path.push(bestIndex);
    unvisited.delete(bestIndex);
    current = bestIndex;
  }

  return path;
}

function recentlyVisitedAreaPenalty(
  candidateIndex: number,
  path: number[],
  stops: Array<DeliveryStopInput & { priority: DeliveryPriority }>
): number {
  const candidate = stops[candidateIndex - 1];
  const recent = path.slice(-3).filter((index) => index > 0).map((index) => stops[index - 1]);
  const nearbyCount = recent.filter((stop) => haversineDistanceKm(stop, candidate) < 0.8).length;

  return nearbyCount * 90;
}

function routeObjective(
  path: number[],
  stops: Array<DeliveryStopInput & { priority: DeliveryPriority }>,
  matrix: MatrixResult
): number {
  let score = 0;

  for (let i = 0; i < path.length - 1; i++) {
    score += matrix.durationsSec[path[i]][path[i + 1]];
  }

  const frontHalfLimit = Math.ceil(stops.length / 2);
  for (let position = 1; position < path.length; position++) {
    const stop = stops[path[position] - 1];
    if (stop.priority === "HIGH" && position > frontHalfLimit) {
      score += 1800;
    }
    score += getPriorityRank(stop.priority) * position * 20;
  }

  return score;
}

function buildSchedule(
  path: number[],
  stops: Array<DeliveryStopInput & { priority: DeliveryPriority; serviceTimeMin: number }>,
  matrix: MatrixResult,
  startTime?: string
) {
  const startDate = parseStartTime(startTime);
  const orderedStops: DeliveryStopOutput[] = [];
  const violations: DeliveryRouteViolation[] = [];
  let elapsedMinutes = 0;

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const stop = stops[to - 1];
    const legDurationMin = matrix.durationsSec[from][to] / 60;
    const legDistanceKm = matrix.distancesM[from][to] / 1000;
    elapsedMinutes += legDurationMin;

    const arrival = new Date(startDate.getTime() + elapsedMinutes * 60000);
    const windowViolation = getTimeWindowViolation(stop, arrival);

    if (windowViolation) {
      violations.push({
        stopId: stop.id,
        type: "TIME_WINDOW",
        message: windowViolation,
      });
    }

    const frontHalfLimit = Math.ceil(stops.length / 2);
    if (stop.priority === "HIGH" && i > frontHalfLimit) {
      violations.push({
        stopId: stop.id,
        type: "PRIORITY",
        message: "High priority stop landed outside the front half of the route",
      });
    }

    orderedStops.push({
      ...stop,
      sequence: i,
      estimatedArrival: arrival.toISOString(),
      estimatedArrivalLabel: arrival.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      etaMinutesFromStart: Math.round(elapsedMinutes),
      legDistanceKm: round(legDistanceKm, 2),
      legDurationMin: Math.round(legDurationMin),
    });

    elapsedMinutes += stop.serviceTimeMin ?? DEFAULT_SERVICE_TIME_MIN;
  }

  return { orderedStops, violations };
}

async function getRouteGeometry(points: GeoPoint[], osrmBaseUrl: string): Promise<RouteGeometryResult> {
  try {
    if (points.length < 2) {
      return {
        coordinates: points.map((point) => [point.lat, point.lng]),
        distanceKm: 0,
        durationMin: 0,
        source: "fallback",
      };
    }

    const coords = points.map((point) => `${point.lng},${point.lat}`).join(";");
    const url = `${osrmBaseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const response = await fetchWithTimeout(url, 5000);

    if (!response.ok) {
      throw new Error(`OSRM route returned ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];
    const rawCoordinates = route?.geometry?.coordinates;

    if (!Array.isArray(rawCoordinates)) {
      throw new Error("OSRM route response is missing geometry");
    }

    return {
      coordinates: rawCoordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
      distanceKm: round((route.distance || 0) / 1000, 2),
      durationMin: Math.round((route.duration || 0) / 60),
      source: "osrm",
    };
  } catch (error) {
    console.warn("Falling back to straight-line route geometry:", error);
    return {
      coordinates: points.map((point) => [point.lat, point.lng]),
      distanceKm: round(getFallbackPathDistanceKm(points), 2),
      durationMin: Math.round((getFallbackPathDistanceKm(points) / DEFAULT_AVG_SPEED_KPH) * 60),
      source: "fallback",
    };
  }
}

function getPathDistanceKm(path: number[], matrix: MatrixResult): number {
  let distanceKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    distanceKm += matrix.distancesM[path[i]][path[i + 1]] / 1000;
  }
  return distanceKm;
}

function getPathDurationMin(path: number[], matrix: MatrixResult): number {
  let durationMin = 0;
  for (let i = 0; i < path.length - 1; i++) {
    durationMin += matrix.durationsSec[path[i]][path[i + 1]] / 60;
  }
  return durationMin;
}

function getFallbackPathDistanceKm(points: GeoPoint[]): number {
  let distanceKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    distanceKm += haversineDistanceKm(points[i], points[i + 1]) * 1.25;
  }
  return distanceKm;
}

function getPriorityRank(priority: DeliveryPriority): number {
  if (priority === "HIGH") return 0;
  if (priority === "NORMAL") return 1;
  return 2;
}

function getVehicleCostPerKm(vehicleType: string, explicitCost?: number): number {
  if (Number.isFinite(explicitCost)) {
    return explicitCost as number;
  }

  switch (vehicleType.toLowerCase()) {
    case "bike":
      return 0.02;
    case "motorbike":
      return 0.08;
    case "truck":
      return 0.38;
    case "car":
    default:
      return 0.18;
  }
}

function parseStartTime(startTime?: string): Date {
  const now = new Date();

  if (!startTime) {
    return now;
  }

  if (/^\d{2}:\d{2}$/.test(startTime)) {
    const [hours, minutes] = startTime.split(":").map(Number);
    const date = new Date(now);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  const parsed = new Date(startTime);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

function getTimeWindowViolation(
  stop: DeliveryStopInput,
  arrival: Date
): string | null {
  if (!stop.timeWindowStart && !stop.timeWindowEnd) return null;

  const arrivalMinutes = arrival.getHours() * 60 + arrival.getMinutes();
  const start = parseTimeToMinutes(stop.timeWindowStart);
  const end = parseTimeToMinutes(stop.timeWindowEnd);

  if (start !== null && end !== null && arrivalMinutes > end) {
    return `ETA ${formatMinutes(arrivalMinutes)} is after ${formatMinutes(end)}`;
  }

  if (start !== null && end === null && arrivalMinutes < start) {
    return `ETA ${formatMinutes(arrivalMinutes)} is before ${formatMinutes(start)}`;
  }

  if (end !== null && arrivalMinutes > end) {
    return `ETA ${formatMinutes(arrivalMinutes)} is after ${formatMinutes(end)}`;
  }

  return null;
}

function parseTimeToMinutes(value?: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": process.env.ROUTESENSE_USER_AGENT || "RouteSense/1.0",
      },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}
