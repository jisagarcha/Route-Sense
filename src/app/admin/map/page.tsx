"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RouteMap } from "@/components/route-map";
import { 
  Map as MapIcon, 
  Plus, 
  MapPin, 
  Route,
  Navigation,
  MoreHorizontal,
  X
} from "lucide-react";

interface Location {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
}

interface Road {
  id: number;
  fromLocationId: number;
  toLocationId: number;
  distance: number;
  isBidirectional: boolean;
  fromLocation?: Location;
  toLocation?: Location;
}

export default function MapViewPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Location management
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    description: "",
    latitude: 27.7172,
    longitude: 85.324,
  });

  // Road management
  const [showAddRoad, setShowAddRoad] = useState(false);
  const [showAllRoads, setShowAllRoads] = useState(false);
  const [newRoad, setNewRoad] = useState({
    fromLocationId: "",
    toLocationId: "",
  });

  // Route optimization
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>("");
  const [startingPoint, setStartingPoint] = useState<string>("");
  const [optimizedRoute, setOptimizedRoute] = useState<number[]>([]);
  const [optimizedRouteDetails, setOptimizedRouteDetails] = useState<{
    path: Location[];
    totalDistance: number;
    segments: Array<{ from: string; to: string; distance: number }>;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    console.log("Map data:", {
      locations: locations.length,
      roads: roads.length,
      optimizedRoute: optimizedRoute.length
    });
  }, [locations, roads, optimizedRoute]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [locationsRes, roadsRes] = await Promise.all([
        fetch("/api/locations"),
        fetch("/api/roads"),
      ]);

      const locationsData = await locationsRes.json();
      const roadsData = await roadsRes.json();

      setLocations(locationsData.locations || []);
      setRoads(roadsData.roads || []);
    } catch (err) {
      setError("Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newLocation.name.trim()) {
      setError("Location name is required");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLocation),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create location");
      }

      setSuccess("Location added successfully!");
      setNewLocation({ name: "", description: "", latitude: 27.7172, longitude: 85.324 });
      setShowAddLocation(false);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add location");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoad = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newRoad.fromLocationId || !newRoad.toLocationId) {
      setError("Please select both locations");
      return;
    }

    try {
      setLoading(true);
      
      const from = locations.find((l) => l.id === parseInt(newRoad.fromLocationId));
      const to = locations.find((l) => l.id === parseInt(newRoad.toLocationId));
      
      if (!from || !to) {
        throw new Error("Invalid locations");
      }

      const distance = calculateDistance(
        from.latitude,
        from.longitude,
        to.latitude,
        to.longitude
      );

      const response = await fetch("/api/roads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocationId: parseInt(newRoad.fromLocationId),
          toLocationId: parseInt(newRoad.toLocationId),
          distance: parseFloat(distance.toFixed(2)),
          isBidirectional: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create road");
      }

      setSuccess("Road added successfully!");
      setNewRoad({ fromLocationId: "", toLocationId: "" });
      setShowAddRoad(false);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add road");
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeRoute = async (algorithm: string) => {
    if (!startingPoint) {
      setError("Please select a starting point");
      return;
    }

    if (locations.length < 2) {
      setError("At least 2 locations are required for route optimization");
      return;
    }

    setSelectedAlgorithm(algorithm);
    setError("");
    setSuccess("");

    try {
      setLoading(true);
      
      // Get all location IDs
      const locationIds = locations.map(loc => loc.id);
      
      console.log("Optimizing route:", {
        algorithm,
        startLocationId: parseInt(startingPoint),
        locationIds,
        totalLocations: locations.length
      });

      const response = await fetch("/api/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationIds: locationIds,
          startLocationId: parseInt(startingPoint),
          algorithm,
          returnToStart: false
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to optimize route");
      }

      const data = await response.json();
      console.log("Optimization result:", data);
      
      // Extract location IDs from the optimized path
      const routePath = data?.optimization?.path?.map((loc: Location) => loc.id) || [];
      setOptimizedRoute(routePath);
      
      // Store detailed route information
      const pathLocations = data?.optimization?.path || [];
      const segments = [];
      
      for (let i = 0; i < pathLocations.length - 1; i++) {
        const from = pathLocations[i];
        const to = pathLocations[i + 1];
        const distance = calculateDistance(
          from.latitude,
          from.longitude,
          to.latitude,
          to.longitude
        );
        segments.push({
          from: from.name,
          to: to.name,
          distance: parseFloat(distance.toFixed(2))
        });
      }
      
      setOptimizedRouteDetails({
        path: pathLocations,
        totalDistance: data?.optimization?.totalDistance || 0,
        segments
      });
      
      setSuccess(`Route optimized using ${algorithm}! Total distance: ${data?.optimization?.totalDistance?.toFixed(2) || 'N/A'} km`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to optimize route");
      console.error("Optimization error:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRadians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  if (loading && locations.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map data...</p>
        </div>
      </div>
    );
  }

  const displayedLocations = showAllLocations ? locations : locations.slice(0, 4);
  const displayedRoads = showAllRoads ? roads : roads.slice(0, 4);

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      {/* Grid Layout: Sidebar (col 1) | Map (col 2) */}
      <div className="grid grid-cols-[320px_1fr] h-full">
        {/* Left Sidebar */}
        <div className="bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MapIcon className="h-6 w-6 text-blue-600" />
                RouteSense Map
              </h1>
            </div>

            {/* Alerts */}
            {error && (
              <Alert variant="destructive" className="text-sm">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="text-sm border-green-200 bg-green-50">
                <AlertDescription className="text-green-700">{success}</AlertDescription>
              </Alert>
            )}

            {/* Locations Section */}
         

            {/* Optimized Route Details Section */}
            {optimizedRouteDetails ? (
              <Card className="border-2 border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-blue-600" />
                    Optimized Route ({selectedAlgorithm})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Summary */}
                  <div className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-900">Total Distance</span>
                      <span className="text-sm font-bold text-blue-700">
                        {optimizedRouteDetails.totalDistance.toFixed(2)} km
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-900">Total Stops</span>
                      <span className="text-sm font-bold text-blue-700">
                        {optimizedRouteDetails.path.length}
                      </span>
                    </div>
                  </div>

                  {/* Route Segments */}
                  <div>
                    <Label className="text-xs font-semibold mb-2 block text-blue-900">
                      Route Sequence
                    </Label>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {optimizedRouteDetails.segments.map((segment, index) => (
                        <div
                          key={index}
                          className="p-2 bg-white rounded border border-blue-200 hover:border-blue-400 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-900 truncate">
                                {segment.from}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <span>→</span>
                                <span className="truncate">{segment.to}</span>
                              </div>
                              <div className="text-xs text-blue-600 font-medium mt-1">
                                {segment.distance} km
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clear Route Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOptimizedRoute([]);
                      setOptimizedRouteDetails(null);
                      setSelectedAlgorithm("");
                    }}
                    className="w-full text-xs"
                  >
                    Clear Route
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                 <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Locations
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddLocation(!showAddLocation)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showAddLocation && (
                  <form onSubmit={handleAddLocation} className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        size={1}
                        value={newLocation.name}
                        onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                        placeholder="Location name"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Latitude</Label>
                        <Input
                          type="number"
                          step="any"
                          value={newLocation.latitude}
                          onChange={(e) => setNewLocation({ ...newLocation, latitude: parseFloat(e.target.value) })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Longitude</Label>
                        <Input
                          type="number"
                          step="any"
                          value={newLocation.longitude}
                          onChange={(e) => setNewLocation({ ...newLocation, longitude: parseFloat(e.target.value) })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" className="h-7 text-xs">Add</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAddLocation(false)}
                        className="h-7 text-xs"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {displayedLocations.map((location) => (
                    <div
                      key={location.id}
                      className="p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="text-sm font-semibold">{location.name}</div>
                      <div className="text-xs text-gray-600">
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>

                {locations.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllLocations(!showAllLocations)}
                    className="w-full text-xs"
                  >
                    <MoreHorizontal className="h-3 w-3 mr-1" />
                    {showAllLocations ? 'Show Less' : `See ${locations.length - 4} More`}
                  </Button>
                )}

                {locations.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">No locations yet</p>
                )}
              </CardContent>
            </Card>

            {/* Roads Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Route className="h-4 w-4" />
                    Roads
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddRoad(!showAddRoad)}
                    disabled={locations.length < 2}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showAddRoad && (
                  <form onSubmit={handleAddRoad} className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                    <div>
                      <Label className="text-xs">From</Label>
                      <Select
                        value={newRoad.fromLocationId}
                        onValueChange={(value) => setNewRoad({ ...newRoad, fromLocationId: value })}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id.toString()}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <Select
                        value={newRoad.toLocationId}
                        onValueChange={(value) => setNewRoad({ ...newRoad, toLocationId: value })}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id.toString()}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" className="h-7 text-xs">Add</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAddRoad(false)}
                        className="h-7 text-xs"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {displayedRoads.map((road) => {
                    const from = locations.find(l => l.id === road.fromLocationId);
                    const to = locations.find(l => l.id === road.toLocationId);
                    return (
                      <div
                        key={road.id}
                        className="p-2 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="text-xs font-semibold">
                          {from?.name} → {to?.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {road.distance} km {road.isBidirectional && '(↔)'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {roads.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllRoads(!showAllRoads)}
                    className="w-full text-xs"
                  >
                    <MoreHorizontal className="h-3 w-3 mr-1" />
                    {showAllRoads ? 'Show Less' : `See ${roads.length - 4} More`}
                  </Button>
                )}

                {roads.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">No roads yet</p>
                )}
              </CardContent>
            </Card>
              
              </>
            )}
          </div>
        </div>

        {/* Full Screen Map with Floating Optimize Section */}
        <div className="relative bg-gray-100">
          {/* Map */}
          {locations.length > 0 ? (
            <div className="absolute inset-0">
              <RouteMap
                locations={locations}
                roads={roads}
                routePath={optimizedRoute}
                center={[27.7172, 85.324]}
                zoom={13}
                height="100vh"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MapIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No locations to display</p>
                <p className="text-sm text-gray-500">Add locations to see them on the map</p>
              </div>
            </div>
          )}

          {/* Floating Optimize Route Panel - Top Right */}
          <div className="absolute top-4 right-4 z-[1000] max-w-2xl">
            <Card className="shadow-xl border-2 border-gray-300 bg-white/95 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-blue-600" />
                  Optimize Route
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Starting Point Selector */}
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Starting Point</Label>
                    <Select
                      value={startingPoint}
                      onValueChange={setStartingPoint}
                    >
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue placeholder="Select starting location" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Selected Starting Point */}
                        {startingPoint && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-white">
                              Selected Starting Point
                            </div>
                            <SelectItem 
                              key={startingPoint} 
                              value={startingPoint}
                              className="bg-white border-l-4 border-l-blue-500"
                            >
                              <div className="flex items-center gap-2 bg-white">
                                <MapPin className="h-3 w-3 text-blue-600" />
                                <span className="font-semibold">
                                  {locations.find(l => l.id.toString() === startingPoint)?.name}
                                </span>
                              </div>
                            </SelectItem>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 mt-1">
                              Other Locations
                            </div>
                          </>
                        )}
                        
                        {/* Other Locations */}
                        {locations
                          .filter(loc => loc.id.toString() !== startingPoint)
                          .map((loc) => (
                            <SelectItem key={loc.id} value={loc.id.toString()}>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 text-gray-400" />
                                {loc.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Algorithm Buttons */}
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Select Algorithm</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        variant={selectedAlgorithm === 'nearest-neighbor' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleOptimizeRoute('nearest-neighbor')}
                        disabled={!startingPoint || loading}
                        className="h-14 flex flex-col items-center justify-center text-xs"
                      >
                        <div className="text-lg mb-0.5">NN</div>
                        <div className="font-semibold">Nearest</div>
                      </Button>

                      <Button
                        variant={selectedAlgorithm === '2-opt' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleOptimizeRoute('2-opt')}
                        disabled={!startingPoint || loading}
                        className="h-14 flex flex-col items-center justify-center text-xs"
                      >
                        <div className="text-lg mb-0.5">2O</div>
                        <div className="font-semibold">2-Opt</div>
                      </Button>

                      <Button
                        variant={selectedAlgorithm === 'simulated-annealing' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleOptimizeRoute('simulated-annealing')}
                        disabled={!startingPoint || loading}
                        className="h-14 flex flex-col items-center justify-center text-xs"
                      >
                        <div className="text-lg mb-0.5">SA</div>
                        <div className="font-semibold">Anneal</div>
                      </Button>

                      <Button
                        variant={selectedAlgorithm === 'genetic' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleOptimizeRoute('genetic')}
                        disabled={!startingPoint || loading}
                        className="h-14 flex flex-col items-center justify-center text-xs"
                      >
                        <div className="text-lg mb-0.5">GA</div>
                        <div className="font-semibold">Genetic</div>
                      </Button>
                    </div>
                  </div>

                  {/* Route Info */}
                  {optimizedRoute.length > 0 && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-blue-900">
                          {selectedAlgorithm} Algorithm
                        </div>
                        <div className="text-xs text-blue-700 font-medium">
                          {optimizedRoute.length} locations
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
