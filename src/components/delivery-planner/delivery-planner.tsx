"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  GripVertical,
  LocateFixed,
  Loader2,
  Navigation,
  PackagePlus,
  Play,
  Plus,
  RotateCw,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GeoPoint } from "@/lib/delivery-routing";
import { DeliveryMap } from "./delivery-map";
import { useGeolocation } from "./use-geolocation";
import type { DeliveryHistoryEntry, OptimizedRoute, PlannerStop, StopPriority, StopStatus } from "./types";

const STATE_KEY = "routesense.deliveryPlanner.v1";
const HISTORY_KEY = "routesense.deliveryHistory.v1";
const DEFAULT_DEPOT = { lat: 27.7172, lng: 85.324 };
const MapLocationPicker = dynamic(() => import("@/components/MapLocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-md bg-slate-100" />,
});

interface StopFormState {
  address: string;
  recipientName: string;
  priority: StopPriority;
  timeWindowStart: string;
  timeWindowEnd: string;
  notes: string;
}

interface GeocodeResponse {
  results: Array<{
    query: string;
    found: boolean;
    address?: string;
    lat?: number;
    lng?: number;
    error?: string;
  }>;
  error?: string;
}

interface OptimizeResponse {
  success?: boolean;
  route?: OptimizedRoute;
  error?: string;
}

interface StoredPlannerState {
  depot: GeoPoint;
  stops: PlannerStop[];
  route: OptimizedRoute | null;
  active: boolean;
  vehicleType: string;
  startTime: string;
}

const emptyForm: StopFormState = {
  address: "",
  recipientName: "",
  priority: "NORMAL",
  timeWindowStart: "",
  timeWindowEnd: "",
  notes: "",
};

export function DeliveryPlanner() {
  const { data: session } = useSession();
  const geo = useGeolocation();
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [depot, setDepot] = useState<GeoPoint>(DEFAULT_DEPOT);
  const [depotAddress, setDepotAddress] = useState("Kathmandu, Nepal");
  const [vehicleType, setVehicleType] = useState("motorbike");
  const [startTime, setStartTime] = useState(() => getDefaultStartTime());
  const [stops, setStops] = useState<PlannerStop[]>([]);
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [history, setHistory] = useState<DeliveryHistoryEntry[]>([]);
  const [active, setActive] = useState(false);
  const [form, setForm] = useState<StopFormState>(emptyForm);
  const [pasteText, setPasteText] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"geocode" | "optimize" | "deliver" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deviationWarning, setDeviationWarning] = useState("");
  const [lastAutoReroute, setLastAutoReroute] = useState(0);
  const [useLiveAsDepot, setUseLiveAsDepot] = useState(false);

  const orderedStops = route?.orderedStops?.length ? route.orderedStops : stops;
  const activeStop = orderedStops.find((stop) => stop.status === "PENDING") || null;
  const completedCount = orderedStops.filter((stop) => stop.status === "COMPLETED").length;
  const progressPercent = orderedStops.length ? Math.round((completedCount / orderedStops.length) * 100) : 0;
  const dailySummary = useMemo(() => summarizeHistory(history), [history]);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);

    const stored = localStorage.getItem(STATE_KEY);
    const storedHistory = localStorage.getItem(HISTORY_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredPlannerState;
        setDepot(parsed.depot || DEFAULT_DEPOT);
        setStops(parsed.stops || []);
        setRoute(parsed.route || null);
        setActive(parsed.active || false);
        setVehicleType(parsed.vehicleType || "motorbike");
        setStartTime(parsed.startTime || getDefaultStartTime());
      } catch {
        localStorage.removeItem(STATE_KEY);
      }
    }

    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory) as DeliveryHistoryEntry[]);
      } catch {
        localStorage.removeItem(HISTORY_KEY);
      }
    }

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const state: StoredPlannerState = { depot, stops, route, active, vehicleType, startTime };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [active, depot, mounted, route, startTime, stops, vehicleType]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, mounted]);

  useEffect(() => {
    if (useLiveAsDepot && geo.position) {
      setDepot({ lat: geo.position.lat, lng: geo.position.lng });
      setDepotAddress("Live GPS position");
      setUseLiveAsDepot(false);
      setNotice("Start location updated from live GPS.");
    }
  }, [geo.position, useLiveAsDepot]);

  const optimizeRoute = useCallback(
    async (overrideDepot?: GeoPoint, auto = false) => {
      if (stops.length === 0) {
        setError("Add at least one stop before optimizing.");
        return;
      }

      setBusy("optimize");
      setError("");
      if (!auto) setNotice("");

      try {
        const response = await fetch("/api/delivery/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            depot: overrideDepot || depot,
            stops: stops.map((stop) => ({
              id: stop.id,
              address: stop.resolvedAddress || stop.address,
              recipientName: stop.recipientName,
              notes: stop.notes,
              priority: stop.priority,
              timeWindowStart: stop.timeWindowStart || null,
              timeWindowEnd: stop.timeWindowEnd || null,
              lat: stop.lat,
              lng: stop.lng,
            })),
            startTime,
            vehicleType,
          }),
        });
        const data = (await response.json()) as OptimizeResponse;

        if (!response.ok || !data.route) {
          throw new Error(data.error || "Failed to optimize route.");
        }

        const mergedStops = mergeOptimizedStops(data.route, stops);
        const mergedRoute = { ...data.route, orderedStops: mergedStops };
        setRoute(mergedRoute);
        setStops(mergedStops);
        if (overrideDepot) setDepot(overrideDepot);
        setNotice(auto ? "Route recalculated from live position." : "Route optimized.");
        setDeviationWarning("");
      } catch (routeError) {
        setError(routeError instanceof Error ? routeError.message : "Failed to optimize route.");
      } finally {
        setBusy(null);
      }
    },
    [depot, startTime, stops, vehicleType]
  );

  useEffect(() => {
    if (!active || !geo.position || !route?.geometry.coordinates.length) return;

    const distanceKm = minDistanceToRouteKm(
      { lat: geo.position.lat, lng: geo.position.lng },
      route.geometry.coordinates
    );

    if (distanceKm < 0.5) {
      setDeviationWarning("");
      return;
    }

    setDeviationWarning("You appear to be off route. RouteSense will recalculate if deviation continues.");

    const now = Date.now();
    if (distanceKm > 0.8 && now - lastAutoReroute > 120000) {
      setLastAutoReroute(now);
      void optimizeRoute({ lat: geo.position.lat, lng: geo.position.lng }, true);
    }
  }, [active, geo.position, lastAutoReroute, optimizeRoute, route?.geometry.coordinates]);

  const addStop = async () => {
    if (!form.address.trim()) {
      setError("Enter a delivery address.");
      return;
    }

    setBusy("geocode");
    setError("");
    setNotice("");

    try {
      const result = await geocodeAddresses([form.address]);
      const match = result[0];

      if (!match?.found || !Number.isFinite(match.lat) || !Number.isFinite(match.lng)) {
        throw new Error(match?.error || "Could not geocode address. Please check and retry.");
      }

      const nextStop = toPlannerStop(form, match);
      setStops((currentStops) => [...currentStops, nextStop]);
      setRoute(null);
      setForm(emptyForm);
      setNotice("Stop added.");
    } catch (geocodeError) {
      setError(geocodeError instanceof Error ? geocodeError.message : "Could not geocode address.");
    } finally {
      setBusy(null);
    }
  };

  const addPastedStops = async () => {
    const addresses = pasteText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (addresses.length === 0) {
      setError("Paste one address per line.");
      return;
    }

    setBusy("geocode");
    setError("");
    setNotice("");

    try {
      const results = await geocodeAddresses(addresses);
      const createdStops = results
        .filter((result) => result.found && Number.isFinite(result.lat) && Number.isFinite(result.lng))
        .map((result) =>
          toPlannerStop(
            {
              ...emptyForm,
              address: result.query,
              priority: "NORMAL",
            },
            result
          )
        );

      const failed = results.length - createdStops.length;
      if (createdStops.length === 0) {
        throw new Error("None of the pasted addresses could be geocoded.");
      }

      setStops((currentStops) => [...currentStops, ...createdStops]);
      setRoute(null);
      setPasteText("");
      setNotice(failed ? `Added ${createdStops.length} stops. ${failed} addresses need review.` : `Added ${createdStops.length} stops.`);
    } catch (geocodeError) {
      setError(geocodeError instanceof Error ? geocodeError.message : "Could not geocode pasted addresses.");
    } finally {
      setBusy(null);
    }
  };

  const removeStop = (id: string) => {
    setStops((currentStops) => currentStops.filter((stop) => stop.id !== id));
    setRoute(null);
  };

  const markCurrentDelivered = () => {
    if (!activeStop || !route) return;

    setBusy("deliver");
    const nextStatus = updateStopStatus(route, stops, activeStop.id, "COMPLETED");
    setStops(nextStatus.stops);
    setRoute(nextStatus.route);

    const remaining = nextStatus.route.orderedStops.some((stop) => stop.status === "PENDING");
    if (!remaining) {
      const entry: DeliveryHistoryEntry = {
        id: createId(),
        completedAt: new Date().toISOString(),
        totalDistanceKm: nextStatus.route.totalDistanceKm,
        totalDurationMin: nextStatus.route.totalDurationMin,
        stopsCompleted: nextStatus.route.orderedStops.length,
        fuelCost: nextStatus.route.fuelCost,
        routeSource: nextStatus.route.routeSource,
      };
      setHistory((currentHistory) => [entry, ...currentHistory].slice(0, 50));
      setActive(false);
      setNotice("Delivery route completed and logged.");
    }

    window.setTimeout(() => setBusy(null), 250);
  };

  const startDelivery = () => {
    if (!route) {
      setError("Optimize the route before starting delivery.");
      return;
    }
    setActive(true);
    if (!geo.watching) geo.start();
  };

  const clearRoute = () => {
    if (!confirm("Clear all stops and cached route?")) return;
    setStops([]);
    setRoute(null);
    setActive(false);
    setNotice("");
    setError("");
    localStorage.removeItem(STATE_KEY);
  };

  const useCurrentLocationAsDepot = () => {
    setUseLiveAsDepot(true);
    geo.start();
    if (geo.position) {
      setDepot({ lat: geo.position.lat, lng: geo.position.lng });
      setDepotAddress("Live GPS position");
      setUseLiveAsDepot(false);
      setNotice("Start location updated from live GPS.");
    }
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const sourceIndex = stops.findIndex((stop) => stop.id === draggingId);
    const targetIndex = stops.findIndex((stop) => stop.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...stops];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setStops(reordered);
    setRoute(null);
    setDraggingId(null);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-96px)] bg-slate-50 text-slate-900">
      <div className="grid min-h-[calc(100vh-96px)] grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(360px,3fr)]">
        <section className="relative h-[58vh] min-h-[430px] overflow-hidden bg-slate-200 lg:h-[calc(100vh-96px)]">
          <DeliveryMap
            depot={depot}
            stops={orderedStops}
            route={route}
            activeStopId={activeStop?.id}
            livePosition={geo.position}
          />

          <div className="absolute left-3 top-3 z-[500] flex flex-wrap gap-2">
            <Badge className="h-9 rounded-md bg-white px-3 text-slate-700 shadow-md hover:bg-white">
              {online ? <Wifi className="mr-2 h-4 w-4 text-green-600" /> : <WifiOff className="mr-2 h-4 w-4 text-red-600" />}
              {online ? "Online" : "Offline cache"}
            </Badge>
            {route && (
              <Badge className="h-9 rounded-md bg-white px-3 text-slate-700 shadow-md hover:bg-white">
                {route.routeSource.toUpperCase()} route
              </Badge>
            )}
          </div>

          {active && activeStop && (
            <div className="absolute inset-x-3 bottom-3 z-[500] rounded-md border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Current stop
                  </p>
                  <h2 className="truncate text-lg font-bold">{activeStop.recipientName || activeStop.address}</h2>
                  <p className="line-clamp-2 text-sm text-slate-600">{activeStop.resolvedAddress || activeStop.address}</p>
                </div>
                <Button
                  className="h-12 shrink-0 bg-green-600 px-4 hover:bg-green-700"
                  onClick={markCurrentDelivered}
                  disabled={busy === "deliver"}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Delivered
                </Button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-green-600" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {completedCount} of {orderedStops.length} stops completed
              </p>
            </div>
          )}
        </section>

        <aside className="max-h-none overflow-y-auto border-l border-slate-200 bg-white lg:max-h-[calc(100vh-96px)]">
          <div className="space-y-5 p-4 sm:p-5">
            <header className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-blue-700">RouteSense</p>
                  <h1 className="text-2xl font-bold tracking-normal">Delivery Route Planner</h1>
                </div>
                {session?.user && (
                  <Badge variant="outline" className="rounded-md">
                    {session.user.role}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Metric label="Stops" value={String(orderedStops.length)} />
                <Metric label="Distance" value={route ? `${route.totalDistanceKm.toFixed(1)} km` : "--"} />
                <Metric label="Fuel" value={route ? `$${route.fuelCost.toFixed(2)}` : "--"} />
              </div>
            </header>

            {(error || notice || geo.error || deviationWarning) && (
              <div className="space-y-2">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {geo.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{geo.error}</AlertDescription>
                  </Alert>
                )}
                {deviationWarning && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                    <AlertDescription className="text-amber-800">{deviationWarning}</AlertDescription>
                  </Alert>
                )}
                {notice && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-700" />
                    <AlertDescription className="text-green-800">{notice}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <section className="space-y-3 rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Start</h2>
                <Button variant="outline" className="h-11" onClick={useCurrentLocationAsDepot}>
                  <LocateFixed className="h-4 w-4" />
                  GPS
                </Button>
              </div>
              <MapLocationPicker
                label="Start location"
                initialLat={depot.lat}
                initialLng={depot.lng}
                height="300px"
                onLocationSelect={(lat, lng, address) => {
                  setDepot({ lat, lng });
                  setDepotAddress(address);
                }}
              />
              <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-500">
                {depotAddress} ({depot.lat.toFixed(5)}, {depot.lng.toFixed(5)})
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="start-time">Start time</Label>
                  <Input id="start-time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="vehicle">Vehicle</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger id="vehicle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bike">Bike</SelectItem>
                      <SelectItem value="motorbike">Motorbike</SelectItem>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-md border border-slate-200 p-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Add Stop</h2>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                  placeholder="Paste a full delivery address"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="recipient">Recipient</Label>
                  <Input
                    id="recipient"
                    value={form.recipientName}
                    onChange={(event) => setForm({ ...form, recipientName: event.target.value })}
                    placeholder="Name"
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as StopPriority })}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="window-start">Window start</Label>
                  <Input
                    id="window-start"
                    type="time"
                    value={form.timeWindowStart}
                    onChange={(event) => setForm({ ...form, timeWindowStart: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="window-end">Window end</Label>
                  <Input
                    id="window-end"
                    type="time"
                    value={form.timeWindowEnd}
                    onChange={(event) => setForm({ ...form, timeWindowEnd: event.target.value })}
                  />
                </div>
              </div>
              <Input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Notes"
              />
              <Button className="h-12 w-full bg-blue-600 hover:bg-blue-700" onClick={addStop} disabled={busy === "geocode"}>
                {busy === "geocode" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Geocode and Add
              </Button>
            </section>

            <section className="space-y-3 rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Bulk Addresses</h2>
                <Button variant="outline" className="h-11" onClick={addPastedStops} disabled={busy === "geocode"}>
                  <PackagePlus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={"One address per line"}
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Stops</h2>
                <Badge variant="outline" className="rounded-md">
                  Drag to reorder
                </Badge>
              </div>

              <div className="space-y-2">
                {orderedStops.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No stops added
                  </div>
                ) : (
                  orderedStops.map((stop, index) => (
                    <StopRow
                      key={stop.id}
                      stop={stop}
                      index={index}
                      active={stop.id === activeStop?.id}
                      draggable={!route}
                      onDragStart={() => setDraggingId(stop.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDrop(stop.id)}
                      onRemove={() => removeStop(stop.id)}
                    />
                  ))
                )}
              </div>
            </section>

            {route?.violations.length ? (
              <section className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">Constraint Alerts</h2>
                {route.violations.map((violation) => (
                  <p key={`${violation.stopId}-${violation.type}`} className="text-sm text-amber-800">
                    {violation.message}
                  </p>
                ))}
              </section>
            ) : null}

            <section className="grid grid-cols-2 gap-2">
              <Button
                className="h-12 bg-blue-600 hover:bg-blue-700"
                onClick={() => optimizeRoute()}
                disabled={busy === "optimize" || stops.length === 0}
              >
                {busy === "optimize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                Optimize
              </Button>
              <Button className="h-12 bg-slate-900 hover:bg-slate-800" onClick={startDelivery} disabled={!route || active}>
                <Play className="h-4 w-4" />
                Start
              </Button>
              <Button variant="outline" className="h-12" onClick={geo.watching ? geo.stop : geo.start}>
                <Navigation className="h-4 w-4" />
                {geo.watching ? "Stop GPS" : "Track GPS"}
              </Button>
              <Button variant="outline" className="h-12 text-red-700 hover:bg-red-50" onClick={clearRoute}>
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </section>

            <section className="space-y-3 rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Daily Summary</h2>
                <Button variant="outline" className="h-10" onClick={() => exportHistory(history)} disabled={!history.length}>
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Done" value={String(dailySummary.stops)} />
                <Metric label="Km" value={dailySummary.distanceKm.toFixed(1)} />
                <Metric label="Min" value={String(dailySummary.minutes)} />
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function StopRow({
  stop,
  index,
  active,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
}: {
  stop: PlannerStop;
  index: number;
  active: boolean;
  draggable: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-md border p-3 ${active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-bold">
          {draggable ? <GripVertical className="h-4 w-4 text-slate-500" /> : index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{stop.recipientName || `Stop ${index + 1}`}</p>
            <PriorityBadge priority={stop.priority} />
            {stop.status === "COMPLETED" && <Badge className="bg-blue-600">Completed</Badge>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{stop.resolvedAddress || stop.address}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {stop.estimatedArrivalLabel && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ETA {stop.estimatedArrivalLabel}
              </span>
            )}
            {stop.legDistanceKm !== undefined && <span>{stop.legDistanceKm.toFixed(1)} km leg</span>}
            {(stop.timeWindowStart || stop.timeWindowEnd) && (
              <span>
                {stop.timeWindowStart || "--"}-{stop.timeWindowEnd || "--"}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-red-600" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: StopPriority }) {
  if (priority === "HIGH") return <Badge className="bg-amber-600">High</Badge>;
  if (priority === "LOW") return <Badge variant="outline">Low</Badge>;
  return <Badge className="bg-slate-700">Normal</Badge>;
}

async function geocodeAddresses(addresses: string[]) {
  const response = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses }),
  });
  const data = (await response.json()) as GeocodeResponse;

  if (!response.ok) {
    throw new Error(data.error || "Could not geocode address.");
  }

  return data.results;
}

function toPlannerStop(
  form: StopFormState,
  result: GeocodeResponse["results"][number]
): PlannerStop {
  return {
    id: createId(),
    address: form.address || result.query,
    resolvedAddress: result.address,
    recipientName: form.recipientName,
    notes: form.notes,
    priority: form.priority,
    timeWindowStart: form.timeWindowStart,
    timeWindowEnd: form.timeWindowEnd,
    lat: Number(result.lat),
    lng: Number(result.lng),
    status: "PENDING",
  };
}

function mergeOptimizedStops(route: OptimizedRoute, currentStops: PlannerStop[]): PlannerStop[] {
  const currentById = new Map(currentStops.map((stop) => [stop.id, stop]));

  return route.orderedStops.map((stop) => {
    const current = currentById.get(stop.id);
    return {
      ...current,
      ...stop,
      timeWindowStart: current?.timeWindowStart || stop.timeWindowStart || "",
      timeWindowEnd: current?.timeWindowEnd || stop.timeWindowEnd || "",
      status: current?.status || "PENDING",
    } as PlannerStop;
  });
}

function updateStopStatus(
  route: OptimizedRoute,
  stops: PlannerStop[],
  stopId: string,
  status: StopStatus
) {
  const update = (stop: PlannerStop) => (stop.id === stopId ? { ...stop, status } : stop);
  const nextStops = stops.map(update);
  const nextRoute = {
    ...route,
    orderedStops: route.orderedStops.map(update),
  };

  return { stops: nextStops, route: nextRoute };
}

function summarizeHistory(history: DeliveryHistoryEntry[]) {
  const today = new Date().toDateString();
  return history
    .filter((entry) => new Date(entry.completedAt).toDateString() === today)
    .reduce(
      (summary, entry) => ({
        stops: summary.stops + entry.stopsCompleted,
        distanceKm: summary.distanceKm + entry.totalDistanceKm,
        minutes: summary.minutes + entry.totalDurationMin,
      }),
      { stops: 0, distanceKm: 0, minutes: 0 }
    );
}

function exportHistory(history: DeliveryHistoryEntry[]) {
  const header = "completedAt,stopsCompleted,totalDistanceKm,totalDurationMin,fuelCost,routeSource";
  const rows = history.map((entry) =>
    [
      entry.completedAt,
      entry.stopsCompleted,
      entry.totalDistanceKm,
      entry.totalDurationMin,
      entry.fuelCost,
      entry.routeSource,
    ].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `routesense-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function minDistanceToRouteKm(point: GeoPoint, coordinates: Array<[number, number]>) {
  if (!coordinates.length) return Number.POSITIVE_INFINITY;

  return coordinates.reduce((min, coordinate) => {
    const distance = distanceKm(point, { lat: coordinate[0], lng: coordinate[1] });
    return Math.min(min, distance);
  }, Number.POSITIVE_INFINITY);
}

function distanceKm(a: GeoPoint, b: GeoPoint) {
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

function getDefaultStartTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `stop-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
