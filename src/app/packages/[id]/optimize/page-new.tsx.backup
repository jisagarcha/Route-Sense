'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RouteMap } from '@/components/route-map';
import { 
  MapPin, 
  Package,
  Navigation,
  MoreHorizontal,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Box,
  Weight,
  TruckIcon
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  weight: number;
  volumeCubicFt: number;
  isCritical: boolean;
}

interface PackageItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
  deliveryLat: number | null;
  deliveryLong: number | null;
  deliveryAddress: string | null;
  sequence: number | null;
}

interface PackageData {
  id: string;
  packageName: string;
  status: string;
  notes: string | null;
  totalWeight: number;
  totalVolume: number;
  isCritical: boolean;
  warehouseLat: number | null;
  warehouseLong: number | null;
  warehouseAddress: string | null;
  items: PackageItem[];
}

interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description?: string | null;
}

export default function OptimizePackagePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [packageId, setPackageId] = useState<string>('');
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Delivery locations state
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [deliveryLocations, setDeliveryLocations] = useState<Location[]>([]);
  
  // Route optimization
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>("");
  const [optimizedRoute, setOptimizedRoute] = useState<number[]>([]);
  const [optimizedRouteDetails, setOptimizedRouteDetails] = useState<{
    path: Location[];
    totalDistance: number;
    segments: Array<{ from: string; to: string; distance: number }>;
  } | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      setPackageId(id);
      fetchPackageData(id);
    });
  }, []);

  useEffect(() => {
    if (packageData) {
      // Build delivery locations from package items
      const locations: Location[] = [];
      
      // Add warehouse as first location
      const warehouseLat = packageData.warehouseLat || 27.7172;
      const warehouseLong = packageData.warehouseLong || 85.324;
      
      locations.push({
        id: 0,
        name: 'Warehouse',
        latitude: warehouseLat,
        longitude: warehouseLong,
        description: packageData.warehouseAddress || 'Default Warehouse Location'
      });
      
      // Add delivery locations with default coordinates if not set
      packageData.items.forEach((item, index) => {
        const baseLatOffset = (index % 5) * 0.01 - 0.02;
        const baseLngOffset = Math.floor(index / 5) * 0.01 - 0.02;
        
        locations.push({
          id: index + 1,
          name: item.deliveryAddress || `${item.quantity}x ${item.product.name}`,
          latitude: item.deliveryLat || (27.7172 + baseLatOffset),
          longitude: item.deliveryLong || (85.324 + baseLngOffset),
          description: `${item.quantity}x ${item.product.name}${item.deliveryLat && item.deliveryLong ? '' : ' - Default location'}`
        });
      });
      
      setDeliveryLocations(locations);
    }
  }, [packageData]);

  const fetchPackageData = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/packages/${id}`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch package');
      }
      
      const data = await res.json();
      setPackageData(data.package);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load package');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeRoute = async (algorithm: string) => {
    if (deliveryLocations.length < 2) {
      setError("At least 2 delivery locations are required");
      return;
    }

    setSelectedAlgorithm(algorithm);
    setError("");
    setSuccess("");
    setOptimizing(true);

    try {
      const response = await fetch("/api/optimize-multi-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseLat: deliveryLocations[0].latitude,
          warehouseLong: deliveryLocations[0].longitude,
          stops: deliveryLocations.slice(1).map(loc => ({
            lat: loc.latitude,
            long: loc.longitude,
            address: loc.description || loc.name
          }))
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to optimize route");
      }

      const data = await response.json();
      
      // Build route path from optimized sequence
      const routePath = [0, ...data.optimizedSequence.map((idx: number) => idx + 1)];
      setOptimizedRoute(routePath);
      
      // Calculate segments
      const pathLocations = routePath.map(idx => deliveryLocations[idx]);
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
        totalDistance: data.totalDistance || 0,
        segments
      });
      
      setSuccess(`Route optimized! Total distance: ${data.totalDistance?.toFixed(2)} km`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to optimize route");
      console.error("Optimization error:", err);
    } finally {
      setOptimizing(false);
    }
  };

  const handleProceedToDelivery = async () => {
    if (!optimizedRouteDetails || !packageData) {
      setError("Please optimize the route first");
      return;
    }

    try {
      setOptimizing(true);
      
      // Update package with optimized route data
      const firstStop = packageData.items[0];
      const response = await fetch(`/api/packages/${packageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryLat: firstStop.deliveryLat,
          deliveryLong: firstStop.deliveryLong,
          deliveryAddress: firstStop.deliveryAddress,
          totalDistance: optimizedRouteDetails.totalDistance,
          routeAlgorithm: selectedAlgorithm,
          items: packageData.items.map((item, index) => ({
            id: item.id,
            sequence: optimizedRoute.indexOf(index + 1)
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update package');
      }

      // Navigate to assign driver page
      router.push(`/packages/${packageId}/assign`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to proceed');
    } finally {
      setOptimizing(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading package data...</p>
        </div>
      </div>
    );
  }

  if (!packageData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Package not found</p>
          <Button onClick={() => router.push('/packages')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Packages
          </Button>
        </div>
      </div>
    );
  }

  const displayedLocations = showAllLocations ? deliveryLocations : deliveryLocations.slice(0, 5);

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      {/* Grid Layout: Sidebar (col 1) | Map (col 2) */}
      <div className="grid grid-cols-[380px_1fr] h-full">
        {/* Left Sidebar */}
        <div className="bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Back Button & Header */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/packages/${packageId}`)}
                className="mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Navigation className="h-6 w-6 text-blue-600" />
                Optimize Route
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

            {/* Package Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Package Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-lg font-semibold">{packageData.packageName}</div>
                  <Badge className="mt-1" variant={packageData.status === 'PENDING' ? 'secondary' : 'default'}>
                    {packageData.status}
                  </Badge>
                  {packageData.isCritical && (
                    <Badge variant="destructive" className="ml-2">⚠️ Critical</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Box className="h-3 w-3" />
                      <span className="text-xs">Items</span>
                    </div>
                    <div className="font-semibold">{packageData.items.length}</div>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Weight className="h-3 w-3" />
                      <span className="text-xs">Weight</span>
                    </div>
                    <div className="font-semibold">{packageData.totalWeight.toFixed(1)} kg</div>
                  </div>
                </div>

                {packageData.notes && (
                  <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                    <strong>Notes:</strong> {packageData.notes}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Locations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Delivery Locations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {displayedLocations.map((location, index) => (
                  <div
                    key={location.id}
                    className="p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {index === 0 ? (
                        <div className="flex-shrink-0 text-lg">🏭</div>
                      ) : (
                        <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {index}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {index === 0 ? 'Warehouse' : location.name}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {location.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          📍 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {deliveryLocations.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllLocations(!showAllLocations)}
                    className="w-full text-xs"
                  >
                    <MoreHorizontal className="h-3 w-3 mr-1" />
                    {showAllLocations ? 'Show Less' : `See ${deliveryLocations.length - 5} More`}
                  </Button>
                )}

                {deliveryLocations.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No delivery locations set
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Optimized Route Details */}
            {optimizedRouteDetails && (
              <Card className="border-2 border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Optimized Route
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
                        {optimizedRouteDetails.path.length - 1}
                      </span>
                    </div>
                  </div>

                  {/* Route Segments */}
                  <div>
                    <Label className="text-xs font-semibold mb-2 block text-blue-900">
                      Route Sequence
                    </Label>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {optimizedRouteDetails.segments.map((segment, index) => (
                        <div
                          key={index}
                          className="p-2 bg-white rounded border border-blue-200"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-700">
                                {index === 0 ? '🏭 ' : ''}{segment.from.replace(/^\d+x\s/, '')}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <span>→</span>
                                <span className="truncate">{segment.to.replace(/^\d+x\s/, '')}</span>
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
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Map Area */}
        <div className="relative bg-gray-100">
          {/* Map */}
          {deliveryLocations.length > 0 ? (
            <div className="absolute inset-0">
              <RouteMap
                locations={deliveryLocations}
                routePath={optimizedRoute}
                center={deliveryLocations[0] ? [deliveryLocations[0].latitude, deliveryLocations[0].longitude] : [27.7172, 85.324]}
                zoom={13}
                height="100vh"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No delivery locations to display</p>
              </div>
            </div>
          )}

          {/* Floating Action Panel - Top Right */}
          <div className="absolute top-4 right-4 z-[1000] max-w-md">
            <Card className="shadow-xl border-2 border-gray-300 bg-white/95 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-blue-600" />
                  Route Optimization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Algorithm Buttons */}
                <div>
                  <Label className="text-xs font-semibold mb-2 block">Select Algorithm</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={selectedAlgorithm === 'Nearest Neighbor' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleOptimizeRoute('Nearest Neighbor')}
                      disabled={optimizing || deliveryLocations.length < 2}
                      className="h-12 flex flex-col items-center justify-center text-xs"
                    >
                      <div className="text-base mb-0.5">🔵</div>
                      <div className="font-semibold">Nearest</div>
                    </Button>

                    <Button
                      variant={selectedAlgorithm === 'Genetic' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleOptimizeRoute('Genetic')}
                      disabled={optimizing || deliveryLocations.length < 2}
                      className="h-12 flex flex-col items-center justify-center text-xs"
                    >
                      <div className="text-base mb-0.5">🟢</div>
                      <div className="font-semibold">Genetic</div>
                    </Button>
                  </div>
                </div>

                {/* Proceed Button */}
                <Button
                  onClick={handleProceedToDelivery}
                  disabled={!optimizedRouteDetails || optimizing}
                  className="w-full"
                  size="sm"
                >
                  {optimizing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <TruckIcon className="mr-2 h-4 w-4" />
                      Proceed to Assign Driver
                    </>
                  )}
                </Button>

                {!optimizedRouteDetails && (
                  <p className="text-xs text-gray-500 text-center">
                    Optimize route to proceed
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
