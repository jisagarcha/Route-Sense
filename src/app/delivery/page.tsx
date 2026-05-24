'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package as PackageIcon, MapPin, Clock, CheckCircle, Loader2, Play } from 'lucide-react';

interface PackageData {
  id: string;
  packageName: string;
  status: string;
  totalWeight: number;
  totalVolume: number;
  isCritical: boolean;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLong: number | null;
  delivery: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  items: Array<{
    quantity: number;
    product: {
      name: string;
      weight: number;
    };
  }>;
}

export default function DeliveryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [packages, setPackages] = useState<PackageData[]>([]);

  const fetchAssignedPackages = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/packages');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch deliveries');
      }

      const driverPackages = (data.packages as PackageData[]).filter((pkg) =>
        pkg.status === 'ASSIGNED' || pkg.status === 'IN_TRANSIT'
      );
      setPackages(driverPackages);
    } catch (error) {
      console.error('Error fetching packages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignedPackages();
  }, [fetchAssignedPackages]);

  const handleStartDelivery = async (packageId: string) => {
    setStartingId(packageId);
    setError('');
    try {
      const res = await fetch(`/api/deliveries/${packageId}/start`, {
        method: 'POST'
      });
      const data = await res.json();

      if (res.ok) {
        setPackages((currentPackages) =>
          currentPackages.map((pkg) =>
            pkg.id === packageId
              ? { ...pkg, status: 'IN_TRANSIT', delivery: data.delivery }
              : pkg
          )
        );
        router.push(`/delivery/${packageId}`);
      } else {
        setError(data.error || 'Failed to start delivery');
      }
    } catch (error) {
      console.error('Error starting delivery:', error);
      setError(error instanceof Error ? error.message : 'Failed to start delivery');
    } finally {
      setStartingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ASSIGNED: 'bg-blue-100 text-blue-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800'
    };

    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">My Deliveries</h1>
        <p className="text-gray-600 mb-8">
          Your assigned delivery packages
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {packages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No active deliveries</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {packages.map(pkg => (
              <Card key={pkg.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2 mb-2">
                        {pkg.packageName}
                        {getStatusBadge(pkg.status)}
                        {pkg.isCritical && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                      </CardTitle>
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4" />
                          {pkg.deliveryAddress || 'Delivery address pending'}
                        </div>
                        <div className="flex items-center gap-2">
                          <PackageIcon className="h-4 w-4" />
                          {pkg.items.length} items • {pkg.totalWeight} kg
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Package Items */}
                    <div className="p-3 bg-gray-50 rounded">
                      <h4 className="font-semibold text-sm mb-2">Package Contents</h4>
                      <ul className="text-sm space-y-1">
                        {pkg.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span>{item.product.name}</span>
                            <span className="text-gray-600">
                              {item.quantity}x ({item.product.weight * item.quantity} kg)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Delivery Status */}
                    {pkg.delivery && (
                      <div className="flex items-center justify-between text-sm">
                        {pkg.delivery.startedAt ? (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="h-4 w-4" />
                            Started: {new Date(pkg.delivery.startedAt).toLocaleTimeString()}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="h-4 w-4" />
                            Not started yet
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      {pkg.status === 'ASSIGNED' && (
                        <Button
                          onClick={() => handleStartDelivery(pkg.id)}
                          disabled={startingId === pkg.id}
                          className="flex-1"
                        >
                          {startingId === pkg.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Start Delivery
                            </>
                          )}
                        </Button>
                      )}
                      {pkg.status === 'IN_TRANSIT' && (
                        <Button
                          onClick={() => router.push(`/delivery/${pkg.id}`)}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Continue Delivery
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/packages/${pkg.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
