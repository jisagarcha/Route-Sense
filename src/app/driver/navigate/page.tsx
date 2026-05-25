"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, Phone, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RouteMap } from "@/components/route-map";
import { PackageStatusBadge } from "@/components/PackageStatusBadge";

interface DriverPackage {
  id: string;
  packageName: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLong: number | null;
  status: string;
  totalWeight: number;
  notes: string | null;
  failureReason?: string | null;
  route?: {
    orderedStopIds: string[];
    polylineJson: string | null;
    estimatedArrivals: Record<string, string> | null;
  } | null;
}

interface LivePosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

export default function DriverNavigatePage() {
  const { data: session } = useSession();
  const [packages, setPackages] = useState<DriverPackage[]>([]);
  const [livePosition, setLivePosition] = useState<LivePosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState("Not home");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const lastLocationPost = useRef(0);
  const lastReroute = useRef(0);

  const fetchPackages = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/packages?limit=100");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch packages");
      setPackages((data.packages || []).filter((pkg: DriverPackage) =>
        ['ASSIGNED', 'COLLECTED_FROM_WAREHOUSE', 'IN_TRANSIT', 'FAILED'].includes(pkg.status)
      ));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load navigation");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPackages();
  }, [fetchPackages]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLivePosition(nextPosition);

        const now = Date.now();
        if (session?.user?.id && now - lastLocationPost.current > 30000) {
          lastLocationPost.current = now;
          void fetch(`/api/drivers/${session.user.id}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: nextPosition.lat,
              lng: nextPosition.lng,
              timestamp: new Date().toISOString(),
            }),
          });
        }
      },
      (geoError) => setError(geoError.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [session?.user?.id]);

  const orderedPackages = useMemo(() => {
    const routeOrder = packages.find((pkg) => pkg.route?.orderedStopIds?.length)?.route?.orderedStopIds || [];
    const orderIndex = new Map(routeOrder.map((id, index) => [id, index]));
    return [...packages].sort((a, b) => (orderIndex.get(a.id) ?? 999) - (orderIndex.get(b.id) ?? 999));
  }, [packages]);

  const activeStop = orderedPackages.find((pkg) => !['DELIVERED', 'FAILED'].includes(pkg.status)) || null;
  const routePolyline = useMemo(() => {
    const routeWithPolyline = orderedPackages.find((pkg) => pkg.route?.polylineJson);
    if (routeWithPolyline?.route?.polylineJson) {
      try {
        return JSON.parse(routeWithPolyline.route.polylineJson) as Array<[number, number]>;
      } catch {
        return [];
      }
    }

    return orderedPackages
      .filter((pkg) => Number.isFinite(Number(pkg.deliveryLat)) && Number.isFinite(Number(pkg.deliveryLong)))
      .map((pkg) => [Number(pkg.deliveryLat), Number(pkg.deliveryLong)] as [number, number]);
  }, [orderedPackages]);

  useEffect(() => {
    if (!livePosition || !activeStop || routePolyline.length < 2) return;
    const distanceToRoute = minDistanceToRouteKm(livePosition, routePolyline);
    const now = Date.now();

    if (distanceToRoute <= 0.5) {
      if (notice.includes("off route")) setNotice("");
      return;
    }

    setNotice("You're off route - Recalculating...");
    if (now - lastReroute.current > 120000) {
      lastReroute.current = now;
      void fetch("/api/routes/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: activeStop.id,
          driverCurrentLat: livePosition.lat,
          driverCurrentLng: livePosition.lng,
        }),
      }).then(() => fetchPackages());
    }
  }, [activeStop, fetchPackages, livePosition, notice, routePolyline]);

  const updateStatus = async (packageId: string, status: string, reason?: string) => {
    setBusy(`${packageId}-${status}`);
    setError("");
    try {
      const response = await fetch(`/api/packages/${packageId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          failureReason: reason,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update stop");
      setPackages((current) => current.map((pkg) => pkg.id === packageId ? data.package : pkg));
      setNotice(status === "DELIVERED" ? "Stop marked delivered." : "Stop updated.");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update stop");
    } finally {
      setBusy(null);
    }
  };

  const routeStops = orderedPackages
    .filter((pkg) => Number.isFinite(Number(pkg.deliveryLat)) && Number.isFinite(Number(pkg.deliveryLong)))
    .map((pkg, index) => ({
      id: pkg.id,
      lat: Number(pkg.deliveryLat),
      lng: Number(pkg.deliveryLong),
      label: String(index + 1),
      address: pkg.deliveryAddress || pkg.packageName,
      status: pkg.status,
    }));

  const mapCenter: [number, number] = livePosition
    ? [livePosition.lat, livePosition.lng]
    : routeStops[0]
      ? [routeStops[0].lat, routeStops[0].lng]
      : [27.7172, 85.3120];

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <main className="bg-slate-50 text-slate-950">
      <div className="mx-auto grid h-[calc(100dvh-96px)] max-w-[1600px] grid-rows-[58fr_42fr] gap-4 p-4">
        <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Live navigation</p>
                <h1 className="text-lg font-semibold">Driver route tracker</h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span className={`rounded-full px-3 py-1 font-medium ${livePosition ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {livePosition ? "GPS active" : "Waiting for GPS"}
                </span>
                {activeStop && (
                  <span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700">
                    Next stop: {activeStop.packageName}
                  </span>
                )}
              </div>
            </div>

            <div className="h-full min-h-0 flex-1 bg-slate-100">
              <RouteMap
                locations={[]}
                stops={routeStops}
                polyline={routePolyline}
                driverPosition={livePosition}
                highlightedStopId={activeStop?.id}
                center={mapCenter}
                zoom={14}
                height="100%"
              />
            </div>
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="mx-auto max-w-md space-y-3 p-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {notice && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-900">{notice}</AlertDescription>
              </Alert>
            )}

            {activeStop ? (
              <>
                <div className="space-y-2">
                  <PackageStatusBadge status={activeStop.status} />
                  <h2 className="text-2xl font-bold leading-tight">{activeStop.deliveryAddress || activeStop.packageName}</h2>
                  <p className="text-sm text-slate-600">{activeStop.recipientName || "Recipient pending"}</p>
                  {activeStop.recipientPhone && <p className="text-sm text-slate-600">{activeStop.recipientPhone}</p>}
                  {activeStop.notes && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{activeStop.notes}</p>}
                  <p className="text-sm text-slate-500">{activeStop.totalWeight} kg</p>
                </div>

                <div className="space-y-2">
                  {activeStop.status === "ASSIGNED" && (
                    <Button
                      className="h-14 w-full bg-rose-600 text-base hover:bg-rose-700"
                      disabled={busy !== null}
                      onClick={() => updateStatus(activeStop.id, "COLLECTED_FROM_WAREHOUSE")}
                    >
                      <PackageCheck className="h-5 w-5" />
                      Confirm Collected from Warehouse
                    </Button>
                  )}

                  <Button
                    className="h-14 w-full bg-emerald-600 text-base hover:bg-emerald-700"
                    disabled={busy !== null}
                    onClick={() => updateStatus(activeStop.id, "DELIVERED")}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Mark as Delivered
                  </Button>

                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      value={failureReason}
                      onChange={(event) => setFailureReason(event.target.value)}
                      className="h-14 rounded-md border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option>Not home</option>
                      <option>Wrong address</option>
                      <option>Refused</option>
                    </select>
                    <Button
                      variant="outline"
                      className="h-14 border-red-200 text-red-700 hover:bg-red-50"
                      disabled={busy !== null}
                      onClick={() => updateStatus(activeStop.id, "FAILED", failureReason)}
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>

                  {activeStop.recipientPhone && (
                    <Button asChild variant="outline" className="h-14 w-full border-slate-200">
                      <a href={`tel:${activeStop.recipientPhone}`}>
                        <Phone className="h-5 w-5" />
                        Call Recipient
                      </a>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
                <h1 className="text-xl font-bold">All stops completed</h1>
                <p className="text-sm text-slate-500">Your active route is clear.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function minDistanceToRouteKm(point: LivePosition, polyline: Array<[number, number]>) {
  return polyline.reduce((min, coordinate) => {
    const distance = distanceKm(point, { lat: coordinate[0], lng: coordinate[1] });
    return Math.min(min, distance);
  }, Number.POSITIVE_INFINITY);
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
