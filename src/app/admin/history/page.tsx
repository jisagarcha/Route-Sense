'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RouteMap } from '@/components/route-map';

interface RouteRequest {
  id: number;
  sourceLocation: { name: string };
  targetLocation: { name: string };
  totalDistance: number;
  pathLocations: string[];
  createdAt: string;
}

interface DriverOption {
  id: string;
  name: string | null;
  email: string;
}

interface DriverRoute {
  id: string;
  packageName: string;
  status: string;
  priority: string;
  driver: DriverOption | null;
  dispatcher: DriverOption | null;
  warehouseAddress: string | null;
  warehouseLat: number | null;
  warehouseLong: number | null;
  deliveryAddress: string | null;
  polyline: Array<[number, number]>;
  stopCount: number;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  actualDurationMin: number | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  failureReason: string | null;
  stops: Array<{
    id: string;
    address: string;
    lat: number | null;
    lng: number | null;
    recipientName: string | null;
    status: string;
    productName: string | null;
  }>;
}

export default function HistoryPage() {
  const [routes, setRoutes] = useState<RouteRequest[]>([]);
  const [driverRoutes, setDriverRoutes] = useState<DriverRoute[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [actualRoutePolyline, setActualRoutePolyline] = useState<Array<[number, number]>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoutes(selectedDriverId);
  }, [selectedDriverId]);

  const fetchRoutes = async (driverId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (driverId) params.set('driverId', driverId);
      const response = await fetch(`/api/route-history?${params}`);
      const data = await response.json();
      setRoutes(data.routeRequests || []);
      setDriverRoutes(data.driverRoutes || []);
      setDrivers(data.drivers || []);
      setSelectedRouteId((current) => {
        if (current && (data.driverRoutes || []).some((route: DriverRoute) => route.id === current)) {
          return current;
        }
        return data.driverRoutes?.[0]?.id || null;
      });
    } catch (err) {
      console.error('Failed to fetch route history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatOptionalDate = (dateString: string | null) => {
    return dateString ? new Date(dateString).toLocaleString() : 'Not completed';
  };

  const formatDriverName = (driver: DriverOption | null) => {
    return driver?.name || driver?.email || 'Unassigned';
  };

  const completedRoutes = driverRoutes.filter((route) => route.status === 'DELIVERED').length;
  const failedRoutes = driverRoutes.filter((route) => route.status === 'FAILED').length;
  const totalDistance = driverRoutes.reduce((sum, route) => sum + (route.totalDistanceKm || 0), 0);
  const avgDuration = (() => {
    const durations = driverRoutes
      .map((route) => route.actualDurationMin ?? route.estimatedDurationMin)
      .filter((value): value is number => typeof value === 'number');
    if (durations.length === 0) return null;
    return durations.reduce((sum, value) => sum + value, 0) / durations.length;
  })();
  const selectedRoute = driverRoutes.find((route) => route.id === selectedRouteId) || null;
  const selectedRouteStops = useMemo(() => selectedRoute ? buildMapStops(selectedRoute) : [], [selectedRoute]);
  const selectedRoutePoints = useMemo(() => selectedRoute ? buildRoutePoints(selectedRoute) : [], [selectedRoute]);
  const selectedRoutePolyline =
    actualRoutePolyline.length > 1
      ? actualRoutePolyline
      : selectedRoutePoints.map((point) => [point.lat, point.lng] as [number, number]);
  const hasSelectedRouteMap = Boolean(
    selectedRoute && (selectedRouteStops.length > 0 || selectedRoutePolyline.length > 1)
  );
  const selectedRouteCenter: [number, number] =
    selectedRouteStops[0]
      ? [selectedRouteStops[0].lat, selectedRouteStops[0].lng]
      : selectedRoutePolyline[0] || [27.7172, 85.3120];

  useEffect(() => {
    let cancelled = false;

    async function loadActualRoute() {
      setActualRoutePolyline([]);
      if (selectedRoutePoints.length < 2) return;

      try {
        const response = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: selectedRoutePoints }),
        });
        const data = await response.json();
        const coordinates = data.route?.coordinates;
        if (!cancelled && Array.isArray(coordinates) && coordinates.length > 1) {
          setActualRoutePolyline(coordinates);
        }
      } catch (error) {
        console.error('Failed to load actual route geometry:', error);
      }
    }

    void loadActualRoute();

    return () => {
      cancelled = true;
    };
  }, [selectedRouteId, selectedRoutePoints]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Route History</h1>
        <p className="text-muted-foreground">
          Review driver deliveries, route outcomes, and past route computations for analysis.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Driver Routes</p>
            <p className="text-2xl font-bold">{driverRoutes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold">{completedRoutes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold">{failedRoutes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Distance</p>
            <p className="text-2xl font-bold">{totalDistance.toFixed(1)} km</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Driver Delivery History</CardTitle>
              <CardDescription>
                {driverRoutes.length} route{driverRoutes.length !== 1 ? 's' : ''} from assigned package deliveries
                {avgDuration !== null ? `, average duration ${avgDuration.toFixed(0)} min` : ''}
              </CardDescription>
            </div>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Driver</span>
              <select
                value={selectedDriverId}
                onChange={(event) => setSelectedDriverId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="">All drivers</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {formatDriverName(driver)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {hasSelectedRouteMap && selectedRoute && (
            <div className="mb-6 space-y-3 rounded-md border bg-muted/20 p-3">
              <div>
                <h3 className="text-lg font-semibold">{selectedRoute.packageName} route map</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDriverName(selectedRoute.driver)} - actual stop route with {selectedRoutePolyline.length} road points and {selectedRouteStops.length} stop marker{selectedRouteStops.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="h-[420px] overflow-hidden rounded-md border bg-white">
                <RouteMap
                  key={selectedRoute.id}
                  locations={[]}
                  stops={selectedRouteStops}
                  polyline={selectedRoutePolyline}
                  center={selectedRouteCenter}
                  zoom={13}
                  height="100%"
                />
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stops</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Map</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driverRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No driver route history found. Assign packages to a driver and complete deliveries to build history.
                    </TableCell>
                  </TableRow>
                ) : (
                  driverRoutes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell>
                        <div className="font-medium">{route.packageName}</div>
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {route.warehouseAddress || 'Warehouse'} to {route.deliveryAddress || route.stops[0]?.address || 'Delivery address pending'}
                        </div>
                      </TableCell>
                      <TableCell>{formatDriverName(route.driver)}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                          {route.status.replaceAll('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>{route.stopCount}</TableCell>
                      <TableCell>{route.totalDistanceKm !== null ? `${route.totalDistanceKm.toFixed(2)} km` : 'Pending'}</TableCell>
                      <TableCell>
                        {route.actualDurationMin ?? route.estimatedDurationMin
                          ? `${route.actualDurationMin ?? route.estimatedDurationMin} min`
                          : 'Pending'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatOptionalDate(route.completedAt)}
                        {route.failureReason ? (
                          <div className="max-w-xs truncate text-xs text-red-600">{route.failureReason}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant={selectedRouteId === route.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedRouteId(route.id)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route Computation Requests</CardTitle>
          <CardDescription>
            {routes.length} route{routes.length !== 1 ? 's' : ''} computed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Distance (km)</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No route history found. Compute your first route to see it here.
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell>{route.id}</TableCell>
                      <TableCell className="font-medium">{route.sourceLocation.name}</TableCell>
                      <TableCell className="font-medium">{route.targetLocation.name}</TableCell>
                      <TableCell>{route.totalDistance.toFixed(2)}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {route.pathLocations.join(' → ')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(route.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildMapStops(route: DriverRoute) {
  const stops: Array<{
    id: string;
    lat: number;
    lng: number;
    label: string;
    address: string;
    status: string;
  }> = [];

  if (Number.isFinite(Number(route.warehouseLat)) && Number.isFinite(Number(route.warehouseLong))) {
    stops.push({
      id: `${route.id}:warehouse`,
      lat: Number(route.warehouseLat),
      lng: Number(route.warehouseLong),
      label: 'Start',
      address: route.warehouseAddress || 'Warehouse',
      status: 'WAREHOUSE',
    });
  }

  route.stops.forEach((stop) => {
    if (!Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng))) return;
    stops.push({
      id: stop.id,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      label: String(stops.length + 1),
      address: stop.address,
      status: stop.status,
    });
  });

  return stops;
}

function buildRoutePoints(route: DriverRoute) {
  const points: Array<{ lat: number; lng: number }> = [];

  if (Number.isFinite(Number(route.warehouseLat)) && Number.isFinite(Number(route.warehouseLong))) {
    points.push({
      lat: Number(route.warehouseLat),
      lng: Number(route.warehouseLong),
    });
  }

  route.stops.forEach((stop) => {
    if (!Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng))) return;
    const point = { lat: Number(stop.lat), lng: Number(stop.lng) };
    const previous = points[points.length - 1];
    if (!previous || previous.lat !== point.lat || previous.lng !== point.lng) {
      points.push(point);
    }
  });

  return points;
}
