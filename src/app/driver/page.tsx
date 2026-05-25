"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Package, Play, Route as RouteIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageStatusBadge } from "@/components/PackageStatusBadge";

interface DriverPackage {
  id: string;
  packageName: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryAddress: string | null;
  status: string;
  totalWeight: number;
  notes: string | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  routeId?: string | null;
  route?: { id: string; totalDurationMin: number | null } | null;
}

export default function DriverHomePage() {
  const [packages, setPackages] = useState<DriverPackage[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [routingCount, setRoutingCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchPackages();
  }, []);

  useEffect(() => {
    const needsRoute = packages.filter((pkg) => !pkg.routeId && !pkg.route && ['ASSIGNED', 'COLLECTED_FROM_WAREHOUSE', 'IN_TRANSIT'].includes(pkg.status));
    if (needsRoute.length === 0 || typeof navigator === "undefined" || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void Promise.all(
          needsRoute.map((pkg) =>
            autoRoute(pkg.id, position.coords.latitude, position.coords.longitude)
          )
        );
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages.length]);

  const fetchPackages = async () => {
    setError("");
    try {
      const response = await fetch("/api/packages?limit=100");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch packages");
      setPackages((data.packages || []).filter((pkg: DriverPackage) =>
        ['ASSIGNED', 'COLLECTED_FROM_WAREHOUSE', 'IN_TRANSIT'].includes(pkg.status)
      ));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  const autoRoute = async (packageId: string, lat: number, lng: number) => {
    setRoutingCount((count) => count + 1);
    try {
      await fetch("/api/routes/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, driverCurrentLat: lat, driverCurrentLng: lng }),
      });
      await fetchPackages();
    } finally {
      setRoutingCount((count) => Math.max(0, count - 1));
    }
  };

  const estimatedCompletion = useMemo(() => {
    const minutes = packages.reduce((sum, pkg) => sum + (pkg.route?.totalDurationMin || 18), 0);
    const completion = new Date(Date.now() + minutes * 60000);
    return completion.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [packages]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-96px)] bg-gray-50 px-4 py-5">
      <div className="mx-auto max-w-md space-y-4">
        <Card className="border-orange-200 bg-white">
          <CardContent className="p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-orange-700">Today</p>
              <h1 className="text-2xl font-bold">You have {packages.length} deliveries today</h1>
              <p className="mt-1 text-sm text-gray-600">Estimated completion: {estimatedCompletion}</p>
            </div>
            <Button asChild className="h-14 w-full bg-orange-600 text-base hover:bg-orange-700">
              <a href="/driver/navigate">
                <Play className="h-5 w-5" />
                Start My Route
              </a>
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {routingCount > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <RouteIcon className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-900">
              {routingCount} new packages added - Route updated automatically
            </AlertDescription>
          </Alert>
        )}

        <section className="space-y-3">
          {packages.map((pkg, index) => {
            const expanded = expandedId === pkg.id;
            return (
              <Card key={pkg.id} className="overflow-hidden">
                <button
                  type="button"
                  className="flex min-h-16 w-full items-center gap-3 p-4 text-left"
                  onClick={() => setExpandedId(expanded ? null : pkg.id)}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-100 font-bold text-orange-900">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{pkg.recipientName || pkg.packageName}</span>
                    <span className="block truncate text-sm text-gray-500">{pkg.deliveryAddress || "Address pending"}</span>
                  </span>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <CardContent className="space-y-3 border-t bg-gray-50 p-4 text-sm">
                    <PackageStatusBadge status={pkg.status} />
                    {pkg.recipientPhone && <p>Phone: {pkg.recipientPhone}</p>}
                    {pkg.notes && <p>Notes: {pkg.notes}</p>}
                    {(pkg.timeWindowStart || pkg.timeWindowEnd) && (
                      <p>Window: {formatWindow(pkg.timeWindowStart)} - {formatWindow(pkg.timeWindowEnd)}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{pkg.totalWeight} kg</Badge>
                      <Badge variant="outline">{pkg.routeId || pkg.route ? "Route ready" : "Auto-route pending"}</Badge>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {packages.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  No active deliveries
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-500">
                Assigned stops will appear here when dispatch sends them.
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}

function formatWindow(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
