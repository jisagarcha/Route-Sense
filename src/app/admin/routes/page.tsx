"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Route as RouteIcon, Wand2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageStatusBadge } from "@/components/PackageStatusBadge";

interface Warehouse {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface PackageRow {
  id: string;
  packageName: string;
  status: string;
  deliveryAddress: string | null;
  routeId?: string | null;
  route?: { id: string; isAutoCalculated: boolean } | null;
  totalDistance: number | null;
  driver?: { name: string | null; email: string } | null;
}

export default function AdminRoutesPage() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === warehouseId),
    [warehouseId, warehouses]
  );

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setError("");
    try {
      const [packagesResponse, warehousesResponse] = await Promise.all([
        fetch("/api/packages?limit=100"),
        fetch("/api/warehouses"),
      ]);
      const packagesData = await packagesResponse.json();
      const warehousesData = await warehousesResponse.json();

      if (!packagesResponse.ok) throw new Error(packagesData.error || "Failed to fetch packages");
      if (!warehousesResponse.ok) throw new Error(warehousesData.error || "Failed to fetch warehouses");

      setPackages(packagesData.packages || []);
      setWarehouses(warehousesData.warehouses || []);
      setWarehouseId((current) => current || warehousesData.warehouses?.[0]?.id || "");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load routes");
    } finally {
      setLoading(false);
    }
  };

  const autoRoutePackage = async (packageId: string) => {
    setBusy(packageId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/routes/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          driverCurrentLat: selectedWarehouse?.lat,
          driverCurrentLng: selectedWarehouse?.lng,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to auto-route package");
      setNotice("Auto-route calculated.");
      await fetchData();
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "Failed to auto-route package");
    } finally {
      setBusy(null);
    }
  };

  const optimizeSelected = async () => {
    if (!warehouseId || selectedIds.length === 0) return;
    setBusy("bulk");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageIds: selectedIds, warehouseId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to optimize selected packages");
      setNotice(`Optimized ${data.result?.orderedStops?.length || selectedIds.length} packages.`);
      setSelectedIds([]);
      await fetchData();
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "Failed to optimize selected packages");
    } finally {
      setBusy(null);
    }
  };

  const toggleSelected = (packageId: string) => {
    setSelectedIds((current) =>
      current.includes(packageId)
        ? current.filter((id) => id !== packageId)
        : [...current, packageId]
    );
  };

  const unroutedPackages = packages.filter((pkg) => !pkg.routeId && !pkg.route);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <RouteIcon className="h-7 w-7 text-orange-600" />
            Route Assignment
          </h1>
          <p className="text-gray-600">Auto-route unrouted packages or optimize a selected batch.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <Button onClick={optimizeSelected} disabled={!warehouseId || selectedIds.length === 0 || busy === "bulk"}>
            {busy === "bulk" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Optimize All Routes
          </Button>
        </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-3 pr-3">Select</th>
                    <th className="py-3 pr-3">Package</th>
                    <th className="py-3 pr-3">Status</th>
                    <th className="py-3 pr-3">Route</th>
                    <th className="py-3 pr-3">Driver</th>
                    <th className="py-3 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(pkg.id)}
                          disabled={Boolean(pkg.routeId || pkg.route)}
                          onChange={() => toggleSelected(pkg.id)}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium">{pkg.packageName}</p>
                        <p className="text-xs text-gray-500">{pkg.deliveryAddress || "Address pending"}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <PackageStatusBadge status={pkg.status} />
                      </td>
                      <td className="py-3 pr-3">
                        {pkg.route || pkg.routeId ? (
                          <Badge className={pkg.route?.isAutoCalculated ? "bg-orange-100 text-orange-900" : "bg-green-100 text-green-900"}>
                            {pkg.route?.isAutoCalculated ? "Auto-Calculated" : "Manually Optimized"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">No Route</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-3">{pkg.driver?.name || pkg.driver?.email || "-"}</td>
                      <td className="py-3 pr-3">
                        {!pkg.routeId && !pkg.route ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === pkg.id}
                            onClick={() => autoRoutePackage(pkg.id)}
                          >
                            {busy === pkg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                            Auto-Route
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-500">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {packages.length === 0 && (
                <div className="py-12 text-center text-gray-500">No packages found.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-sm text-gray-500">
        {unroutedPackages.length} packages currently have no route.
      </p>
    </div>
  );
}
