'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Package as PackageIcon, 
  MapPin, 
  User, 
  Clock, 
  Weight, 
  Box,
  Route,
  Calendar,
  Navigation,
  Edit,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { RouteMap } from '@/components/route-map';

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
  deliveryLat: number | null;
  deliveryLong: number | null;
  deliveryAddress: string | null;
  sequence: number | null;
  product: Product;
}

interface PackageData {
  id: string;
  packageName: string;
  status: string;
  totalWeight: number;
  totalVolume: number;
  isCritical: boolean;
  warehouseLat: number | null;
  warehouseLong: number | null;
  deliveryLat: number | null;
  deliveryLong: number | null;
  deliveryAddress: string | null;
  totalDistance: number | null;
  estimatedDuration: number | null;
  routeAlgorithm: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  dispatcher: {
    id: string;
    name: string | null;
    email: string;
  };
  driver: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items: PackageItem[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'ASSIGNED':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'IN_TRANSIT':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'DELIVERED':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export default function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [packageId, setPackageId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setPackageId(id);
      fetchPackageData(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPackageData = async (id: string) => {
    try {
      const res = await fetch(`/api/packages/${id}`);
      const data = await res.json();
      
      if (res.ok && data.package) {
        setPackageData(data.package);
      } else {
        setError(data.error || 'Package not found');
      }
    } catch (err) {
      console.error('Error fetching package:', err);
      setError('Failed to fetch package');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/packages/${packageId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/packages');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete package');
      }
    } catch (err) {
      console.error('Error deleting package:', err);
      alert('Failed to delete package');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !packageData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Package not found'}</p>
          <Button onClick={() => router.push('/packages')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Packages
          </Button>
        </div>
      </div>
    );
  }

  // Prepare map data
  const mapLocations = [];
  const routePath = [];

  // Add warehouse
  if (packageData.warehouseLat !== null && packageData.warehouseLong !== null) {
    mapLocations.push({
      id: 0,
      name: 'Warehouse',
      latitude: packageData.warehouseLat,
      longitude: packageData.warehouseLong,
      description: 'Starting Point'
    });
    routePath.push(0);
  }

  // Add delivery stops in sequence order
  const sortedItems = [...packageData.items].sort((a, b) => 
    (a.sequence ?? 999) - (b.sequence ?? 999)
  );

  sortedItems.forEach((item, index) => {
    if (item.deliveryLat !== null && item.deliveryLong !== null) {
      mapLocations.push({
        id: index + 1,
        name: `Stop ${item.sequence !== null ? item.sequence : index + 1}: ${item.product.name}`,
        latitude: item.deliveryLat,
        longitude: item.deliveryLong,
        description: `${item.quantity}x ${item.product.name}${item.deliveryAddress ? ` - ${item.deliveryAddress}` : ''}`
      });
      routePath.push(index + 1);
    }
  });

  const hasRouteData = mapLocations.length > 0;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Package Details */}
      <div className="w-[400px] flex-shrink-0 overflow-y-auto bg-white border-r border-gray-200">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/packages')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Packages
            </Button>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{packageData.packageName}</h1>
                <Badge className={getStatusColor(packageData.status)}>
                  {packageData.status}
                </Badge>
              </div>
              <PackageIcon className="h-8 w-8 text-gray-400" />
            </div>
            {packageData.isCritical && (
              <Badge variant="destructive" className="mt-2">
                Critical Package
              </Badge>
            )}
          </div>

          {/* Package Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Package Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center">
                  <Weight className="h-4 w-4 mr-2" />
                  Total Weight
                </span>
                <span className="font-semibold">{packageData.totalWeight.toFixed(2)} kg</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center">
                  <Box className="h-4 w-4 mr-2" />
                  Total Volume
                </span>
                <span className="font-semibold">{packageData.totalVolume.toFixed(2)} cu ft</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center">
                  <PackageIcon className="h-4 w-4 mr-2" />
                  Items
                </span>
                <span className="font-semibold">{packageData.items.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Route Info */}
          {packageData.totalDistance && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Route className="h-4 w-4 mr-2" />
                  Route Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Distance</span>
                  <span className="font-semibold">{packageData.totalDistance.toFixed(2)} km</span>
                </div>
                {packageData.estimatedDuration && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Est. Duration
                    </span>
                    <span className="font-semibold">{packageData.estimatedDuration} min</span>
                  </div>
                )}
                {packageData.routeAlgorithm && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Algorithm</span>
                    <span className="font-semibold text-xs">{packageData.routeAlgorithm}</span>
                  </div>
                )}
                {packageData.deliveryAddress && (
                  <div className="pt-2 border-t">
                    <span className="text-gray-600 flex items-center mb-1">
                      <MapPin className="h-4 w-4 mr-2" />
                      Primary Location
                    </span>
                    <p className="text-xs">{packageData.deliveryAddress}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* People */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center">
                <User className="h-4 w-4 mr-2" />
                People
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600 block mb-1">Dispatcher</span>
                <p className="font-semibold">{packageData.dispatcher.name || packageData.dispatcher.email}</p>
              </div>
              {packageData.driver && (
                <div className="pt-3 border-t">
                  <span className="text-gray-600 block mb-1">Assigned Driver</span>
                  <p className="font-semibold">{packageData.driver.name || packageData.driver.email}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Items ({packageData.items.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {item.sequence !== null && (
                          <Badge variant="outline" className="text-xs">
                            #{item.sequence}
                          </Badge>
                        )}
                        <span className="font-semibold text-sm">{item.product.name}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Quantity: {item.quantity} • {item.product.weight * item.quantity} kg
                      </p>
                      {item.deliveryAddress && (
                        <p className="text-xs text-gray-500 mt-1 flex items-start">
                          <MapPin className="h-3 w-3 mr-1 mt-0.5" />
                          {item.deliveryAddress}
                        </p>
                      )}
                    </div>
                    {item.product.isCritical && (
                      <Badge variant="destructive" className="text-xs">Critical</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          {packageData.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{packageData.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Timestamps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span>{new Date(packageData.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Updated</span>
                <span>{new Date(packageData.updatedAt).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            {packageData.status === 'PENDING' && (
              <>
                {!packageData.totalDistance && (
                  <Button
                    onClick={() => router.push(`/packages/${packageId}/optimize`)}
                    className="w-full"
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    Optimize Route
                  </Button>
                )}
                {packageData.totalDistance && !packageData.driver && (
                  <Button
                    onClick={() => router.push(`/packages/${packageId}/assign`)}
                    className="w-full"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Assign Driver
                  </Button>
                )}
              </>
            )}
            
            {packageData.status === 'PENDING' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/packages/${packageId}/optimize`)}
                  className="w-full"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Route
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Package
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Full Screen Map */}
      <div className="flex-1 relative h-full">
        {hasRouteData ? (
          <div className="absolute inset-0">
            <RouteMap
              locations={mapLocations}
              routePath={routePath}
              center={packageData.warehouseLat !== null && packageData.warehouseLong !== null 
                ? [packageData.warehouseLat, packageData.warehouseLong]
                : [27.7172, 85.324]
              }
              zoom={13}
              height="100vh"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <div className="text-center">
              <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Route Data</h3>
              <p className="text-gray-600 mb-4">
                This package hasn&apos;t been optimized yet.
              </p>
              {packageData.status === 'PENDING' && (
                <Button onClick={() => router.push(`/packages/${packageId}/optimize`)}>
                  <Navigation className="mr-2 h-4 w-4" />
                  Optimize Route Now
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
