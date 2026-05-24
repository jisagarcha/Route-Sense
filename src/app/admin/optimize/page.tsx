"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RouteMap } from "@/components/route-map";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Navigation,
  Clock,
  DollarSign,
  TrendingDown,
  X,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface Location {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
}

interface OptimizedLocation {
  sequence: number;
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
}

interface Segment {
  from: string;
  to: string;
  distance: number;
}

interface OptimizationResult {
  path: OptimizedLocation[];
  segments: Segment[];
  totalDistance: number;
  totalStops: number;
  returnToStart: boolean;
  estimatedTime: {
    minutes: number;
    hours: number;
  };
  estimatedCost: {
    fuel: number;
    currency: string;
  };
}

export default function OptimizePage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [startLocation, setStartLocation] = useState<number | null>(null);
  const [algorithm, setAlgorithm] = useState("auto");
  const [returnToStart, setReturnToStart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations");
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    }
  };

  const addLocation = (locationId: number) => {
    if (!selectedLocations.includes(locationId)) {
      setSelectedLocations([...selectedLocations, locationId]);
    }
  };

  const removeLocation = (locationId: number) => {
    setSelectedLocations(selectedLocations.filter((id) => id !== locationId));
    if (startLocation === locationId) {
      setStartLocation(null);
    }
  };

  const handleOptimize = async () => {
    setError("");
    setResult(null);

    if (selectedLocations.length < 2) {
      setError("Please select at least 2 locations");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationIds: selectedLocations,
          algorithm,
          startLocationId: startLocation,
          returnToStart,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to optimize route");
      }

      setResult(data.optimization);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to optimize route");
    } finally {
      setLoading(false);
    }
  };

  const selectedLocationDetails = selectedLocations
    .map((id) => locations.find((loc) => loc.id === id))
    .filter((loc): loc is Location => loc !== undefined);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Stop Route Optimization</h1>
        <p className="text-gray-600 mt-2">
          Select multiple locations and find the optimal visiting order using advanced algorithms
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Locations</CardTitle>
              <CardDescription>Choose the stops for your route</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="location-select">Add Location</Label>
                <Select
                  onValueChange={(value) => addLocation(parseInt(value))}
                >
                  <SelectTrigger id="location-select" className="bg-white">
                    <SelectValue placeholder="Choose a location..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {locations
                      .filter((loc) => !selectedLocations.includes(loc.id))
                      .map((loc) => (
                        <SelectItem key={loc.id} value={loc.id.toString()}>
                          {loc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">
                  Selected Locations ({selectedLocations.length})
                </Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedLocationDetails.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{loc.name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLocation(loc.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {selectedLocations.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No locations selected
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Optimization Settings</CardTitle>
              <CardDescription>Configure the optimization parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="start-location">Starting Location (Optional)</Label>
                <Select
                  value={startLocation?.toString() || "auto"}
                  onValueChange={(value) => setStartLocation(value === "auto" ? null : parseInt(value))}
                >
                  <SelectTrigger id="start-location" className="bg-white">
                    <SelectValue placeholder="Auto-select start..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="auto">Auto-select</SelectItem>
                    {selectedLocationDetails.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="algorithm">Algorithm</Label>
                <Select value={algorithm} onValueChange={setAlgorithm}>
                  <SelectTrigger id="algorithm" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="auto">Auto (Recommended)</SelectItem>
                    <SelectItem value="nearest-neighbor">Nearest Neighbor</SelectItem>
                    <SelectItem value="2-opt">2-Opt</SelectItem>
                    <SelectItem value="simulated-annealing">Simulated Annealing</SelectItem>
                    <SelectItem value="genetic">Genetic Algorithm</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Auto-select chooses the best algorithm based on problem size
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="return-to-start"
                  checked={returnToStart}
                  onChange={(e) => setReturnToStart(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="return-to-start" className="cursor-pointer">
                  Return to starting location
                </Label>
              </div>

              <Button
                onClick={handleOptimize}
                disabled={loading || selectedLocations.length < 2}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    Optimize Route
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Optimization Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {result.totalDistance} km
                    </div>
                    <div className="text-sm text-gray-600">Total Distance</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {result.totalStops}
                    </div>
                    <div className="text-sm text-gray-600">Total Stops</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <Clock className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                    <div className="text-lg font-bold">{result.estimatedTime.minutes} min</div>
                    <div className="text-xs text-gray-600">Est. Time</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
                    <div className="text-lg font-bold">${result.estimatedCost.fuel}</div>
                    <div className="text-xs text-gray-600">Fuel Cost</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map Display */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Route Visualization</CardTitle>
              <CardDescription>
                {result ? "Optimized route path" : "Select locations to see on map"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RouteMap
                locations={selectedLocationDetails}
                routePath={result ? result.path.map((p) => p.id) : selectedLocations}
                height="600px"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Route Details */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Optimized Route Sequence</CardTitle>
            <CardDescription>
              Follow this order for the most efficient route
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.path.map((loc, index) => (
                <div key={loc.id}>
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <Badge
                        variant={index === 0 ? "default" : "secondary"}
                        className="text-lg px-3 py-1"
                      >
                        {loc.sequence}
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{loc.name}</h3>
                      {loc.description && (
                        <p className="text-sm text-gray-600 mt-1">{loc.description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>Lat: {loc.latitude.toFixed(4)}</span>
                        <span>Lng: {loc.longitude.toFixed(4)}</span>
                      </div>
                    </div>
                    {index < result.segments.length && (
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingDown className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {result.segments[index].distance.toFixed(1)} km
                        </span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                  {index < result.path.length - 1 && (
                    <div className="flex items-center justify-center py-2">
                      <div className="h-8 w-px bg-gray-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
