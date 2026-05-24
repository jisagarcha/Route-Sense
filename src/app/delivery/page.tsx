'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package as PackageIcon, MapPin, Clock, CheckCircle, Loader2, Play } from 'lucide-react';

interface PackageData {
  id: string;
  packageName: string;
  totalWeight: number;
  totalVolume: number;
  isCritical: boolean;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLong: number;
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
  const [packages, setPackages] = useState<PackageData[]>([]);

  useEffect(() => {
    fetchAssignedPackages();
  }, []);

  const fetchAssignedPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      const data = await res.json();
      // Filter packages assigned to this driver
      const driverPackages = data.packages.filter((pkg: any) => 
        pkg.status === 'ASSIGNED' || pkg.status === 'IN_TRANSIT'
      );
      setPackages(driverPackages);
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDelivery = async (packageId: string) => {
    try {
      const res = await fetch(`/api/deliveries/${packageId}/start`, {
        method: 'POST'
      });

      if (res.ok) {
        router.push(`/delivery/${packageId}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to start delivery');
      }
    } catch (error) {
      console.error('Error starting delivery:', error);
      alert('Failed to start delivery');
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
                        {getStatusBadge(pkg.delivery?.status || 'ASSIGNED')}
                        {pkg.isCritical && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                      </CardTitle>
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4" />
                          {pkg.deliveryAddress}
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
                      {pkg.delivery?.status === 'ASSIGNED' && (
                        <Button
                          onClick={() => handleStartDelivery(pkg.id)}
                          className="flex-1"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Start Delivery
                        </Button>
                      )}
                      {pkg.delivery?.status === 'IN_TRANSIT' && (
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
