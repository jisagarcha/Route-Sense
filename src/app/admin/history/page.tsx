'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RouteMap } from '@/components/route-map';
import { PackageStatusBadge } from '@/components/PackageStatusBadge';
import { CheckCircle2, RotateCcw, Clock, TrendingUp, AlertCircle } from 'lucide-react';

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
  const [statusFilter, setStatusFilter] = useState('ALL');
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
  const avgDuration = (() => {
    const durations = driverRoutes
      .map((route) => route.actualDurationMin ?? route.estimatedDurationMin)
      .filter((value): value is number => typeof value === 'number');
    if (durations.length === 0) return null;
    return durations.reduce((sum, value) => sum + value, 0) / durations.length;
  })();

  const filteredDriverRoutes = useMemo(() => {
    return driverRoutes.filter((route) => {
      if (statusFilter === 'ALL') return true;
      return route.status === statusFilter;
    });
  }, [driverRoutes, statusFilter]);

  const analytics = useMemo(() => {
    let totalStops = 0;
    let deliveredStops = 0;
    let returnedStops = 0;
    let failedStops = 0;
    const reasonsMap: Record<string, number> = {};

    driverRoutes.forEach((route) => {
      if (route.stops) {
        route.stops.forEach((stop) => {
          totalStops++;
          const st = (stop.status || '').toUpperCase();
          if (st === 'DELIVERED') deliveredStops++;
          else if (st === 'RETURNED') returnedStops++;
          else if (st === 'FAILED' || st === 'CANCELLED') failedStops++;
        });
      }
      if (route.failureReason) {
        reasonsMap[route.failureReason] = (reasonsMap[route.failureReason] || 0) + 1;
      }
    });

    const routesWithVariance = driverRoutes
      .filter((r) => r.estimatedDurationMin != null && r.actualDurationMin != null)
      .map((r) => r.actualDurationMin! - r.estimatedDurationMin!);

    const onTimeRoutes = routesWithVariance.filter((v) => v <= 5).length;
    const onTimeRate = routesWithVariance.length > 0 
      ? Math.round((onTimeRoutes / routesWithVariance.length) * 100) 
      : 100;

    const avgVariance = routesWithVariance.length > 0
      ? parseFloat((routesWithVariance.reduce((sum, v) => sum + v, 0) / routesWithVariance.length).toFixed(1))
      : 0;

    const deliverySuccessRate = totalStops > 0
      ? Math.round((deliveredStops / totalStops) * 100)
      : driverRoutes.length > 0 ? Math.round((completedRoutes / driverRoutes.length) * 100) : 0;

    const returnRate = totalStops > 0
      ? Math.round((returnedStops / totalStops) * 100)
      : 0;

    const topReasons = Object.entries(reasonsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      totalStops,
      deliveredStops,
      returnedStops,
      failedStops,
      deliverySuccessRate,
      returnRate,
      onTimeRate,
      avgVariance,
      topReasons,
    };
  }, [driverRoutes, completedRoutes]);
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

      {/* Analytics KPI Scoreboard */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-100 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Routes & Stops</p>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{driverRoutes.length} <span className="text-sm font-normal text-slate-500">routes</span></p>
            <p className="text-xs text-slate-500">{analytics.totalStops} delivery stops total</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Success Rate</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-800">{analytics.deliverySuccessRate}%</p>
            <p className="text-xs text-slate-500">{completedRoutes} completed deliveries</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Schedule Adherence</p>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-800">{analytics.onTimeRate}% <span className="text-xs font-normal text-slate-500">on-time</span></p>
            <p className="text-xs text-slate-500">
              Avg variance: {analytics.avgVariance > 0 ? `+${analytics.avgVariance}` : analytics.avgVariance} min
            </p>
          </CardContent>
        </Card>

        <Card className="border-rose-100 bg-rose-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Returns & Refusals</p>
              <RotateCcw className="h-4 w-4 text-rose-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-800">{analytics.returnRate}% <span className="text-xs font-normal text-slate-500">returns</span></p>
            <p className="text-xs text-slate-500">{analytics.returnedStops} returned, {analytics.failedStops} failed stops</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Failure & Return Reasons Banner */}
      {analytics.topReasons.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 font-semibold text-sm text-amber-900 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            Top Delivery Exceptions & Root Causes
          </div>
          <div className="flex flex-wrap gap-2">
            {analytics.topReasons.map(([reason, count]) => (
              <Badge key={reason} variant="outline" className="border-amber-300 bg-white text-xs text-amber-800">
                {reason}: <strong className="ml-1">{count}</strong>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Driver Delivery History & Variance</CardTitle>
              <CardDescription>
                {filteredDriverRoutes.length} route{filteredDriverRoutes.length !== 1 ? 's' : ''} shown
                {avgDuration !== null ? `, fleet avg duration ${avgDuration.toFixed(0)} min` : ''}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-slate-600">Filter Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs">
                <span className="font-medium text-slate-600">Filter Driver</span>
                <select
                  value={selectedDriverId}
                  onChange={(event) => setSelectedDriverId(event.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs"
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
                  <TableHead>Variance</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Map</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDriverRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                      No driver routes match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDriverRoutes.map((route) => {
                    const est = route.estimatedDurationMin;
                    const act = route.actualDurationMin;
                    const variance = est != null && act != null ? act - est : null;

                    return (
                      <TableRow key={route.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{route.packageName}</div>
                          <div className="max-w-xs truncate text-xs text-muted-foreground">
                            {route.warehouseAddress || 'Warehouse'} to {route.deliveryAddress || route.stops[0]?.address || 'Delivery address pending'}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDriverName(route.driver)}</TableCell>
                        <TableCell>
                          <PackageStatusBadge status={route.status} className="text-[11px]" />
                        </TableCell>
                        <TableCell className="text-xs">{route.stopCount}</TableCell>
                        <TableCell className="text-xs">{route.totalDistanceKm !== null ? `${route.totalDistanceKm.toFixed(2)} km` : 'Pending'}</TableCell>
                        <TableCell className="text-xs">
                          {act != null ? `${act} min` : est != null ? `Est ${est} min` : 'Pending'}
                        </TableCell>
                        <TableCell>
                          {variance === null ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : variance <= 2 ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">
                              On-Time ({variance > 0 ? `+${variance}` : variance}m)
                            </Badge>
                          ) : variance <= 10 ? (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 text-[10px]">
                              +{variance}m delay
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800 text-[10px]">
                              +{variance}m delay
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatOptionalDate(route.completedAt)}
                          {route.failureReason ? (
                            <div className="max-w-xs truncate text-xs text-red-600 font-medium">{route.failureReason}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant={selectedRouteId === route.id ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setSelectedRouteId(route.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
