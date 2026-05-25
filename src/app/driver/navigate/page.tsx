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
  warehouseLat?: number | null;
  warehouseLong?: number | null;
  warehouseAddress?: string | null;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLong: number | null;
  status: string;
  totalWeight: number;
  notes: string | null;
  failureReason?: string | null;
  items?: Array<{
    id: string;
    productId: string;
    quantity: number;
    recipientName: string | null;
    recipientPhone: string | null;
    deliveryLat: number | null;
    deliveryLong: number | null;
    deliveryAddress: string | null;
    sequence: number | null;
    deliveryStatus: string | null;
    collectedAt: string | null;
    deliveredAt: string | null;
    failureReason: string | null;
    product?: {
      id: string;
      name: string;
    } | null;
  }>;
  route?: {
    orderedStopIds: string[];
    polylineJson: string | null;
    estimatedArrivals: Record<string, string> | null;
  } | null;
}

interface RouteStop {
  id: string;
  packageId: string;
  itemId?: string;
  kind: "warehouse" | "delivery";
  lat: number;
  lng: number;
  label: string;
  address: string;
  status: string;
  packageName: string;
  itemName?: string | null;
  quantity?: number;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryStatus?: string | null;
  collectedAt?: string | null;
  deliveredAt?: string | null;
  failureReason?: string | null;
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

  const routeModel = useMemo(() => {
    const routeStops: RouteStop[] = [];
    const firstWarehouse = orderedPackages.find(
      (pkg) =>
        Number.isFinite(Number(pkg.warehouseLat)) &&
        Number.isFinite(Number(pkg.warehouseLong))
    );

    if (firstWarehouse) {
      routeStops.push({
        id: `${firstWarehouse.id}:warehouse`,
        packageId: firstWarehouse.id,
        kind: "warehouse",
        lat: Number(firstWarehouse.warehouseLat),
        lng: Number(firstWarehouse.warehouseLong),
        label: "Start",
        address: firstWarehouse.warehouseAddress || "Warehouse",
        status: firstWarehouse.status,
        packageName: firstWarehouse.packageName,
      });
    }

    for (const pkg of orderedPackages) {
      const items = [...(pkg.items || [])].sort(
        (a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)
      );

      for (const item of items) {
        const lat = Number(item.deliveryLat);
        const lng = Number(item.deliveryLong);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        routeStops.push({
          id: `${pkg.id}:${item.id}`,
          packageId: pkg.id,
          itemId: item.id,
          kind: "delivery",
          lat,
          lng,
          label: "",
          address: item.deliveryAddress || pkg.deliveryAddress || pkg.packageName,
          status: pkg.status,
          packageName: pkg.packageName,
          itemName: item.product?.name || null,
          quantity: item.quantity,
          recipientName: item.recipientName || null,
          recipientPhone: item.recipientPhone || null,
          deliveryStatus: item.deliveryStatus,
          collectedAt: item.collectedAt ? String(item.collectedAt) : null,
          deliveredAt: item.deliveredAt ? String(item.deliveredAt) : null,
          failureReason: item.failureReason || null,
        });
      }

      if (items.length === 0 && Number.isFinite(Number(pkg.deliveryLat)) && Number.isFinite(Number(pkg.deliveryLong))) {
        routeStops.push({
          id: `${pkg.id}:delivery`,
          packageId: pkg.id,
          kind: "delivery",
          lat: Number(pkg.deliveryLat),
          lng: Number(pkg.deliveryLong),
          label: "",
          address: pkg.deliveryAddress || pkg.packageName,
          status: pkg.status,
          packageName: pkg.packageName,
          recipientName: pkg.recipientName || null,
          recipientPhone: pkg.recipientPhone || null,
        });
      }
    }

    const numberedStops = routeStops.map((stop, index) => ({
      ...stop,
      label: String(index + 1),
    }));

    const routeWithPolyline = orderedPackages.find((pkg) => pkg.route?.polylineJson);
    const computedPolyline =
      numberedStops.length > 1
        ? numberedStops.map((stop) => [stop.lat, stop.lng] as [number, number])
        : [];

    const fallbackPolyline = (() => {
      if (!routeWithPolyline?.route?.polylineJson) return [];
      try {
        return JSON.parse(routeWithPolyline.route.polylineJson) as Array<[number, number]>;
      } catch {
        return [];
      }
    })();

    const activePackage = orderedPackages.find((pkg) => !["DELIVERED", "FAILED"].includes(pkg.status)) || null;
    const activePackageStops = activePackage
      ? numberedStops.filter((stop) => stop.packageId === activePackage.id)
      : [];
    const deliveryStops = numberedStops.filter((stop) => stop.kind === "delivery");
    const pendingDeliveryStops = deliveryStops.filter((stop) => !isTerminalStopStatus(stop.deliveryStatus));
    const completedDeliveryStops = deliveryStops.length - pendingDeliveryStops.length;
    const highlightedStopId =
      activePackageStops.find((stop) => stop.kind === "delivery" && !isTerminalStopStatus(stop.deliveryStatus))?.id ||
      activePackageStops[0]?.id ||
      null;

    return {
      routeStops: numberedStops,
      routePolyline: computedPolyline.length > 1 ? computedPolyline : fallbackPolyline,
      activePackage,
      activePackageStops,
      deliveryStops,
      pendingDeliveryStops,
      completedDeliveryStops,
      highlightedStopId,
    };
  }, [orderedPackages]);

  const activePackage = routeModel.activePackage;
  const routeStops = routeModel.routeStops;
  const routePolyline = routeModel.routePolyline;
  const activePackageStops = routeModel.activePackageStops;
  const deliveryStops = routeModel.deliveryStops;
  const pendingDeliveryStops = routeModel.pendingDeliveryStops;
  const completedDeliveryStops = routeModel.completedDeliveryStops;
  const isRouteLive = activePackage
    ? ["COLLECTED_FROM_WAREHOUSE", "IN_TRANSIT"].includes(activePackage.status)
    : false;
  const hasPendingDeliveryStops = pendingDeliveryStops.length > 0;
  const showDeliveryRoute = isRouteLive && hasPendingDeliveryStops;
  const canUpdateDeliveryStops = showDeliveryRoute;
  const visibleRouteStops = showDeliveryRoute ? routeStops : [];
  const visibleRoutePolyline = showDeliveryRoute ? routePolyline : [];
  const visibleActivePackageStops = showDeliveryRoute ? activePackageStops : activePackageStops.filter((stop) => stop.kind === "warehouse");
  const highlightedStopId = showDeliveryRoute ? routeModel.highlightedStopId : null;
  const recipientSummary = useMemo(() => {
    const recipients = new Set(
      deliveryStops
        .map((stop) => stop.recipientName || stop.address || null)
        .filter((value): value is string => Boolean(value))
    );

    if (recipients.size === 0) return "Recipient pending";
    if (recipients.size === 1) return Array.from(recipients)[0];
    return `${recipients.size} customers`;
  }, [deliveryStops]);

  useEffect(() => {
    if (!livePosition || !activePackage || routePolyline.length < 2) return;
    const distanceToRoute = minDistanceToRouteKm(livePosition, routePolyline);
    const now = Date.now();
    const deliveryStopCount = activePackageStops.filter((stop) => stop.kind === "delivery").length;

    if (distanceToRoute <= 0.5) {
      if (notice.includes("off route")) setNotice("");
      return;
    }

    if (deliveryStopCount > 1) {
      setNotice("You're off route - follow the planned stops.");
      return;
    }

    setNotice("You're off route - Recalculating...");

    if (now - lastReroute.current > 120000) {
      lastReroute.current = now;
      void fetch("/api/routes/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: activePackage.id,
          driverCurrentLat: livePosition.lat,
          driverCurrentLng: livePosition.lng,
        }),
      }).then(() => fetchPackages());
    }
  }, [activePackage, activePackageStops, fetchPackages, livePosition, notice, routePolyline]);

  const handleStartRoute = async () => {
    if (!activePackage) return;

    setBusy(`${activePackage.id}-START`);
    setError("");
    try {
      const response = await fetch(`/api/deliveries/${activePackage.id}/start`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to start route");
      setNotice("Route started from warehouse.");
      await fetchPackages();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start route");
    } finally {
      setBusy(null);
    }
  };

  const updateItemStatus = async (packageId: string, itemId: string, status: "DELIVERED" | "FAILED", reason?: string) => {
    setBusy(`${packageId}-${itemId}-${status}`);
    setError("");
    try {
      const response = await fetch(`/api/packages/${packageId}/items/${itemId}/status`, {
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
      setNotice(status === "DELIVERED" ? "Stop marked delivered." : "Stop marked failed.");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update stop");
    } finally {
      setBusy(null);
    }
  };

  const mapCenter: [number, number] = livePosition
    ? [livePosition.lat, livePosition.lng]
    : visibleRouteStops[0]
      ? [visibleRouteStops[0].lat, visibleRouteStops[0].lng]
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
                {activePackage && (
                  <span className={`rounded-full px-3 py-1 font-medium ${isRouteLive ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                    {isRouteLive ? `${completedDeliveryStops}/${deliveryStops.length} stops complete` : "Route not started"}
                  </span>
                )}
              </div>
            </div>

            <div className="h-full min-h-0 flex-1 bg-slate-100">
                <RouteMap
                  locations={[]}
                  stops={visibleRouteStops}
                  polyline={visibleRoutePolyline}
                  driverPosition={livePosition}
                  highlightedStopId={highlightedStopId}
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

            {activePackage ? (
              <>
                <div className="space-y-2">
                  <PackageStatusBadge status={activePackage.status} />
                  <h2 className="text-2xl font-bold leading-tight">{activePackage.deliveryAddress || activePackage.packageName}</h2>
                  <p className="text-sm text-slate-600">{recipientSummary}</p>
                  {activePackage.notes && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{activePackage.notes}</p>}
                  <p className="text-sm text-slate-500">{activePackage.totalWeight} kg</p>
                </div>

                {!isRouteLive && activePackage.status === "ASSIGNED" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    Collect from the warehouse to load the delivery stops and activate the route.
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route order</p>
                    <p className="text-xs text-slate-500">{activePackageStops.filter((stop) => stop.kind === "delivery").length} delivery stops</p>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <select
                        value={failureReason}
                        onChange={(event) => setFailureReason(event.target.value)}
                        className="h-12 rounded-md border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option>Not home</option>
                        <option>Wrong address</option>
                        <option>Refused</option>
                        <option>Contact unavailable</option>
                      </select>
                      {activePackage.status === "ASSIGNED" && (
                        <Button
                          className="h-12 bg-rose-600 text-sm hover:bg-rose-700"
                          disabled={busy !== null}
                          onClick={handleStartRoute}
                        >
                          <PackageCheck className="h-4 w-4" />
                          Collected from Warehouse
                        </Button>
                      )}
                    </div>

                    {visibleActivePackageStops.map((stop) => {
                      const deliveryStatus = stop.kind === "warehouse"
                        ? activePackage.status
                        : (stop.deliveryStatus || "PENDING");
                      const terminal = stop.kind === "delivery" && isTerminalStopStatus(deliveryStatus);
                      const collectedLabel = stop.collectedAt ? new Date(stop.collectedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
                      return (
                        <div
                          key={stop.id}
                          className="rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                              {stop.label}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {stop.kind === "warehouse" ? "Warehouse start" : stop.address}
                                  </p>
                                  {stop.kind === "delivery" && (
                                    <p className="text-sm text-slate-600">
                                      {stop.itemName ? `${stop.quantity} x ${stop.itemName}` : stop.packageName}
                                    </p>
                                  )}
                                  {stop.recipientName && (
                                    <p className="text-sm text-slate-600">{stop.recipientName}</p>
                                  )}
                                  {stop.recipientPhone && (
                                    <p className="text-xs text-slate-500">{stop.recipientPhone}</p>
                                  )}
                                  {stop.kind === "delivery" && collectedLabel && (
                                    <p className="mt-1 text-xs text-slate-500">Collected {collectedLabel}</p>
                                  )}
                                </div>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                  {formatDeliveryStatus(deliveryStatus)}
                                </span>
                              </div>

                              {stop.kind === "delivery" && !terminal && canUpdateDeliveryStops && stop.itemId && (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <Button
                                    className="h-10 bg-emerald-600 text-sm hover:bg-emerald-700"
                                    disabled={busy !== null}
                                    onClick={() => updateItemStatus(activePackage.id, stop.itemId as string, "DELIVERED")}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Delivered
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="h-10 border-red-200 text-red-700 hover:bg-red-50"
                                    disabled={busy !== null}
                                    onClick={() => updateItemStatus(activePackage.id, stop.itemId as string, "FAILED", failureReason)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Refused
                                  </Button>
                                </div>
                              )}

                              {stop.kind === "delivery" && terminal && (
                                <p className="mt-2 text-xs text-slate-500">
                                  {deliveryStatus === "FAILED"
                                    ? `Failed${stop.failureReason ? ` - ${stop.failureReason}` : ""}`
                                    : stop.deliveredAt
                                      ? `Delivered ${new Date(stop.deliveredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                                      : "Delivered"}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isRouteLive && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                      {pendingDeliveryStops.length === 0
                        ? "All delivery stops are complete."
                        : `${pendingDeliveryStops.length} delivery stops still need action.`}
                    </div>
                  )}

                  {activePackage.recipientPhone && (
                    <Button asChild variant="outline" className="h-12 w-full border-slate-200">
                      <a href={`tel:${activePackage.recipientPhone}`}>
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

function isTerminalStopStatus(status?: string | null) {
  return ["DELIVERED", "FAILED"].includes(String(status || "").toUpperCase());
}

function formatDeliveryStatus(value?: string | null) {
  return String(value || "PENDING").replaceAll("_", " ");
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
