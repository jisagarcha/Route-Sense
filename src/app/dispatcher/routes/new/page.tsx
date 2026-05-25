"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Package, Route as RouteIcon, Truck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteMap } from "@/components/route-map";

interface Warehouse {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface PackageRow {
  id: string;
  packageName: string;
  totalWeight: number;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLong: number | null;
  status: string;
  driverId: string | null;
}

interface Driver {
  id: string;
  name: string | null;
  email: string;
  activePackages: number;
}

interface RouteResult {
  orderedStops: Array<{ id: string; lat: number; lng: number; address: string }>;
  polyline: Array<[number, number]>;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  estimatedArrivals: Array<{ stopId: string; eta: string }>;
  warnings: string[];
}

export default function DispatcherNewRoutePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [driverId, setDriverId] = useState("");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [busy, setBusy] = useState<"load" | "optimize" | "assign" | null>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === warehouseId),
    [warehouseId, warehouses]
  );
  const selectedPackages = packages.filter((pkg) => selectedPackageIds.includes(pkg.id));
  const totalWeight = selectedPackages.reduce((sum, pkg) => sum + pkg.totalWeight, 0);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setBusy("load");
    setError("");
    try {
      const [warehousesResponse, packagesResponse, driversResponse] = await Promise.all([
        fetch("/api/warehouses"),
        fetch("/api/packages?status=PENDING&limit=100"),
        fetch("/api/drivers"),
      ]);
      const warehousesData = await warehousesResponse.json();
      const packagesData = await packagesResponse.json();
      const driversData = await driversResponse.json();

      if (!warehousesResponse.ok) throw new Error(warehousesData.error || "Failed to fetch warehouses");
      if (!packagesResponse.ok) throw new Error(packagesData.error || "Failed to fetch packages");
      if (!driversResponse.ok) throw new Error(driversData.error || "Failed to fetch drivers");

      setWarehouses(warehousesData.warehouses || []);
      setPackages((packagesData.packages || []).filter((pkg: PackageRow) => !pkg.driverId));
      setDrivers(driversData.drivers || []);
      setWarehouseId((current) => current || warehousesData.warehouses?.[0]?.id || "");
      setDriverId((current) => current || driversData.drivers?.[0]?.id || "");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load route builder");
    } finally {
      setBusy(null);
    }
  };

  const togglePackage = (packageId: string) => {
    setSelectedPackageIds((current) =>
      current.includes(packageId)
        ? current.filter((id) => id !== packageId)
        : [...current, packageId]
    );
    setResult(null);
  };

  const optimize = async () => {
    if (!warehouseId || selectedPackageIds.length === 0) return;
    setBusy("optimize");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageIds: selectedPackageIds, warehouseId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to optimize route");
      setResult(data.result);
      setNotice("Route optimized.");
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "Failed to optimize route");
    } finally {
      setBusy(null);
    }
  };

  const assignDriver = async () => {
    if (!driverId || !result) return;
    setBusy("assign");
    setError("");
    setNotice("");
    try {
      for (const packageId of selectedPackageIds) {
        const response = await fetch(`/api/packages/${packageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to assign driver");
      }
      setNotice("Route assigned and dispatched.");
      setSelectedPackageIds([]);
      setResult(null);
      await fetchData();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Failed to assign driver");
    } finally {
      setBusy(null);
    }
  };

  const routeStops = result?.orderedStops.map((stop, index) => ({
    id: stop.id,
    lat: stop.lat,
    lng: stop.lng,
    label: String(index + 1),
    address: stop.address,
  })) || [];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Smart Route Builder</h1>
        <p className="text-gray-600">Build, optimize, and dispatch package routes with road-aware ordering.</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{notice}</AlertDescription>
        </Alert>
      )}

      {busy === "load" ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Step 1 - Select Warehouse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                {selectedWarehouse && (
                  <p className="mt-2 text-sm text-gray-600">{selectedWarehouse.address}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                  Step 2 - Select Packages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex items-center justify-between rounded-md bg-gray-50 p-3 text-sm">
                  <span>{selectedPackageIds.length} selected</span>
                  <span>{totalWeight.toFixed(2)} kg total</span>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto">
                  {packages.map((pkg) => (
                    <label key={pkg.id} className="flex cursor-pointer gap-3 rounded-md border p-3 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedPackageIds.includes(pkg.id)}
                        onChange={() => togglePackage(pkg.id)}
                      />
                      <span>
                        <span className="block font-medium">{pkg.packageName}</span>
                        <span className="block text-xs text-gray-500">{pkg.deliveryAddress || "Address pending"}</span>
                      </span>
                    </label>
                  ))}
                  {packages.length === 0 && (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
                      No unassigned pending packages.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RouteIcon className="h-5 w-5 text-orange-600" />
                  Step 3 - Optimize Route
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="h-12 w-full bg-orange-600 hover:bg-orange-700"
                  disabled={!warehouseId || selectedPackageIds.length === 0 || busy === "optimize"}
                  onClick={optimize}
                >
                  {busy === "optimize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RouteIcon className="h-4 w-4" />}
                  {busy === "optimize" ? "Calculating optimal route using road data..." : "Calculate Best Route"}
                </Button>
                {result && (
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Distance" value={`${result.totalDistanceKm.toFixed(1)} km`} />
                    <Metric label="Time" value={`${result.totalDurationMinutes} min`} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Step 4 - Assign Driver
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  value={driverId}
                  onChange={(event) => setDriverId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name || driver.email} - {driver.activePackages} active
                    </option>
                  ))}
                </select>
                <Button
                  className="h-12 w-full"
                  disabled={!result || !driverId || busy === "assign"}
                  onClick={assignDriver}
                >
                  {busy === "assign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Assign & Dispatch
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Optimized Route Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[560px] overflow-hidden rounded-md border">
                <RouteMap
                  locations={selectedWarehouse ? [{
                    id: 0,
                    name: selectedWarehouse.name,
                    latitude: selectedWarehouse.lat,
                    longitude: selectedWarehouse.lng,
                    description: selectedWarehouse.address,
                  }] : []}
                  stops={routeStops}
                  polyline={result?.polyline || []}
                  center={selectedWarehouse ? [selectedWarehouse.lat, selectedWarehouse.lng] : [27.7172, 85.3120]}
                  height="560px"
                />
              </div>
              {result ? (
                <div className="space-y-2">
                  {result.orderedStops.map((stop, index) => (
                    <div key={stop.id} className="flex items-center gap-3 rounded-md border p-3">
                      <Badge className="bg-orange-600">{index + 1}</Badge>
                      <span className="text-sm">{stop.address}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">
                  Select packages and calculate a route to see the stop order.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
