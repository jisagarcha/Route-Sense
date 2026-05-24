'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Weight
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
      if (packageData.warehouseLat && packageData.warehouseLong) {
        locations.push({
          id: 0,
          name: '🏭 Warehouse',
          latitude: packageData.warehouseLat,
          longitude: packageData.warehouseLong,
          description: packageData.warehouseAddress || 'Warehouse'
        });
      }
      
      // Add delivery locations
      packageData.items.forEach((item, index) => {
        if (item.deliveryLat && item.deliveryLong) {
          locations.push({
            id: index + 1,
            name: `${item.quantity}x ${item.product.name}`,
            latitude: item.deliveryLat,
            longitude: item.deliveryLong,
            description: item.deliveryAddress || `Delivery ${index + 1}`
          });
        }
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
      
      if (res.ok) {
        setPackageData(data.package);
        
        // Initialize item locations from product data
        const locations: Record<string, { lat: string; long: string; address: string }> = {};
        data.package.items.forEach((item: PackageItem) => {
          if (item.product.deliveryLat && item.product.deliveryLong) {
            locations[item.id] = {
              lat: item.product.deliveryLat.toString(),
              long: item.product.deliveryLong.toString(),
              address: item.deliveryAddress || '',
            };
          } else {
            locations[item.id] = {
              lat: '27.7172',
              long: '85.3240',
              address: '',
            };
          }
        });
        setItemLocations(locations);
      }
    } catch (error) {
      console.error('Error fetching package:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateItemLocation = (itemId: string, field: 'lat' | 'long' | 'address', value: string) => {
    setItemLocations(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
    // Clear preview when locations change
    setPreviewRoute(null);
  };

  const handlePreviewRoute = async () => {
    if (!packageData) return;

    // Validate all items have locations
    const missingLocations = packageData.items.filter(item => {
      const loc = itemLocations[item.id];
      return !loc || !loc.lat || !loc.long;
    });

    if (missingLocations.length > 0) {
      alert('Please enter delivery coordinates for all items before previewing');
      return;
    }

    setPreviewingRoute(true);
    try {
      // Prepare stops for optimization
      const stops = packageData.items.map(item => {
        const loc = itemLocations[item.id];
        return {
          productId: item.productId,
          lat: parseFloat(loc.lat),
          long: parseFloat(loc.long),
          address: loc.address || item.product.name,
        };
      });

      // Call optimize-multi-stop API
      const res = await fetch('/api/optimize-multi-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseLat: parseFloat(warehouseLat),
          warehouseLong: parseFloat(warehouseLong),
          stops,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to preview route');
      }

      setPreviewRoute({
        sequence: data.optimizedSequence,
        totalDistance: data.totalDistance,
        algorithm: data.algorithm,
      });
    } catch (error) {
      console.error('Error previewing route:', error);
      alert(error instanceof Error ? error.message : 'Failed to preview route');
    } finally {
      setPreviewingRoute(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (!packageData || !previewRoute) {
      alert('Please preview the route first');
      return;
    }

    setOptimizing(true);
    try {
      // Use the previewed route data
      const optimizeData = {
        optimizedSequence: previewRoute.sequence,
        totalDistance: previewRoute.totalDistance,
        algorithm: previewRoute.algorithm,
        estimatedDuration: Math.ceil(previewRoute.totalDistance * 3) // Rough estimate: 3 min per km
      };

      // Calculate package delivery location (use first stop in optimized sequence)
      const firstStopIndex = optimizeData.optimizedSequence[0];
      const firstItem = packageData.items[firstStopIndex];
      const firstLoc = itemLocations[firstItem.id];

      // Validate coordinates
      if (!firstLoc || !firstLoc.lat || !firstLoc.long) {
        throw new Error('Invalid delivery coordinates for first stop');
      }

      const deliveryLat = parseFloat(firstLoc.lat);
      const deliveryLong = parseFloat(firstLoc.long);

      if (isNaN(deliveryLat) || isNaN(deliveryLong)) {
        throw new Error('Invalid delivery coordinates format');
      }

      // Update package with optimized route
      const updateRes = await fetch(`/api/packages/${packageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseLat: parseFloat(warehouseLat),
          warehouseLong: parseFloat(warehouseLong),
          deliveryLat,
          deliveryLong,
          deliveryAddress: firstLoc.address || 'Multiple stops',
          totalDistance: optimizeData.totalDistance,
          estimatedDuration: optimizeData.estimatedDuration,
          routeAlgorithm: optimizeData.algorithm,
          items: packageData.items.map((item, index) => {
            const loc = itemLocations[item.id];
            const sequenceIndex = optimizeData.optimizedSequence.indexOf(index);
            const lat = parseFloat(loc.lat);
            const long = parseFloat(loc.long);
            
            if (isNaN(lat) || isNaN(long)) {
              throw new Error(`Invalid coordinates for item: ${item.product.name}`);
            }
            
            return {
              id: item.id,
              deliveryLat: lat,
              deliveryLong: long,
              deliveryAddress: loc.address || item.product.name,
              sequence: sequenceIndex,
            };
          }),
        }),
      });

      if (updateRes.ok) {
        // Redirect to package details or driver assignment
        router.push(`/packages/${packageId}/assign`);
      } else {
        const errorData = await updateRes.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to update package');
      }
    } catch (error) {
      console.error('Error optimizing route:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to optimize route';
      alert(`Error: ${errorMessage}\n\nPlease check the console for more details.`);
    } finally {
      setOptimizing(false);
    }
  };

  if (loading || !packageId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!packageData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-center text-red-500">Package not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Find Best Delivery Path</h1>
          <p className="text-gray-600">
            Enter delivery locations for each item to optimize the route
          </p>
        </div>

        {/* Package Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {packageData.packageName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Items:</span>
                <p className="font-semibold">{packageData.items.length}</p>
              </div>
              <div>
                <span className="text-gray-600">Weight:</span>
                <p className="font-semibold">{packageData.totalWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <span className="text-gray-600">Volume:</span>
                <p className="font-semibold">{packageData.totalVolume.toFixed(2)} cu ft</p>
              </div>
            </div>
            {packageData.notes && (
              <p className="mt-3 text-sm text-gray-600">
                <strong>Notes:</strong> {packageData.notes}
              </p>
            )}
            {packageData.isCritical && (
              <Badge variant="destructive" className="mt-3">⚠️ Critical Package</Badge>
            )}
          </CardContent>
        </Card>

        {/* Warehouse Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Warehouse (Starting Point)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={warehouseLat}
                  onChange={(e) => setWarehouseLat(e.target.value)}
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={warehouseLong}
                  onChange={(e) => setWarehouseLong(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {packageData.items.map((item, index) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{item.product.name}</h4>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                  <Badge variant="outline">Stop #{index + 1}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Latitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={itemLocations[item.id]?.lat || ''}
                      onChange={(e) => updateItemLocation(item.id, 'lat', e.target.value)}
                      placeholder="27.7172"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Longitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={itemLocations[item.id]?.long || ''}
                      onChange={(e) => updateItemLocation(item.id, 'long', e.target.value)}
                      placeholder="85.3240"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Address (Optional)</Label>
                  <Input
                    value={itemLocations[item.id]?.address || ''}
                    onChange={(e) => updateItemLocation(item.id, 'address', e.target.value)}
                    placeholder="e.g., Thamel, Kathmandu"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Route Preview Map */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Route Preview
              </CardTitle>
              <Button
                onClick={handlePreviewRoute}
                disabled={previewingRoute}
                variant="outline"
                size="sm"
              >
                {previewingRoute ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Navigation className="mr-2 h-3 w-3" />
                    Preview Shortest Path
                  </>
                )}
              </Button>
            </div>
            {previewRoute && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-blue-900 font-semibold">
                      ✅ Optimized Route Found
                    </span>
                    <p className="text-blue-700 text-xs mt-1">
                      Algorithm: {previewRoute.algorithm}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-900">
                      {previewRoute.totalDistance.toFixed(2)} km
                    </div>
                    <div className="text-xs text-blue-700">Total Distance</div>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <RouteMap
              locations={[
                {
                  id: 0,
                  name: 'Warehouse',
                  latitude: parseFloat(warehouseLat),
                  longitude: parseFloat(warehouseLong),
                  description: 'Starting Point'
                },
                ...packageData.items.map((item, index) => {
                  const loc = itemLocations[item.id];
                  return {
                    id: index + 1,
                    name: `Stop ${index + 1}: ${item.product.name}`,
                    latitude: parseFloat(loc?.lat || '27.7172'),
                    longitude: parseFloat(loc?.long || '85.3240'),
                    description: loc?.address || `${item.quantity}x ${item.product.name}`
                  };
                })
              ]}
              routePath={previewRoute ? [
                0,
                ...previewRoute.sequence.map(idx => idx + 1)
              ] : []}
              center={[parseFloat(warehouseLat), parseFloat(warehouseLong)]}
              zoom={13}
              height="500px"
            />
            {!previewRoute && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">
                  💡 Click &quot;Preview Shortest Path&quot; to see the optimized delivery route
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/packages')}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleOptimizeRoute}
            disabled={optimizing || !previewRoute}
            className="flex-1"
          >
            {optimizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Route...
              </>
            ) : (
              <>
                <Navigation className="mr-2 h-4 w-4" />
                {previewRoute ? 'Confirm & Continue' : 'Preview Route First'}
              </>
            )}
          </Button>
        </div>
        {!previewRoute && (
          <p className="text-center text-sm text-amber-600">
            ⚠️ Please preview the route before continuing
          </p>
        )}
      </div>
    </div>
  );
}
