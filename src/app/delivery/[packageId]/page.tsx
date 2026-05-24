'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, Clock, Loader2, Package as PackageIcon } from 'lucide-react';

interface PackageData {
  id: string;
  packageName: string;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLong: number;
  totalWeight: number;
  isCritical: boolean;
  delivery: {
    id: string;
    status: string;
    startedAt: string;
  } | null;
  items: Array<{
    quantity: number;
    product: { name: string };
  }>;
}

export default function ActiveDeliveryPage() {
  const params = useParams();
  const router = useRouter();
  const packageId = params.packageId as string;
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    fetchPackageData();
  }, [packageId]);

  useEffect(() => {
    if (packageData?.delivery?.startedAt) {
      const startTime = new Date(packageData.delivery.startedAt).getTime();
      const timer = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [packageData]);

  const fetchPackageData = async () => {
    try {
      const res = await fetch(`/api/packages/${packageId}`);
      const data = await res.json();
      if (res.ok) {
        setPackageData(data.package);
      }
    } catch (error) {
      console.error('Error fetching package:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!confirm('Mark this delivery as completed?')) return;
    
    setCompleting(true);
    try {
      const res = await fetch(`/api/deliveries/${packageId}/complete`, {
        method: 'POST'
      });

      if (res.ok) {
        alert('Delivery completed successfully!');
        router.push('/delivery');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to complete delivery');
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      alert('Failed to complete delivery');
    } finally {
      setCompleting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  if (!packageData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-red-600">Package not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Active Delivery</h1>

        {/* Timer Card */}
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Clock className="h-12 w-12 text-blue-600" />
                <div>
                  <div className="text-sm text-gray-600">Elapsed Time</div>
                  <div className="text-4xl font-bold text-blue-600">
                    {formatTime(elapsedTime)}
                  </div>
                </div>
              </div>
              {packageData.isCritical && (
                <Badge variant="destructive" className="text-lg py-2 px-4">
                  Critical Delivery
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Package Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageIcon className="h-6 w-6" />
              {packageData.packageName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <MapPin className="h-5 w-5" />
                <span className="font-semibold">Delivery Address</span>
              </div>
              <p className="text-lg ml-7">{packageData.deliveryAddress}</p>
              <p className="text-sm text-gray-500 ml-7">
                Coordinates: {packageData.deliveryLat.toFixed(4)}, {packageData.deliveryLong.toFixed(4)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded">
              <h4 className="font-semibold mb-2">Package Contents</h4>
              <ul className="space-y-1">
                {packageData.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between text-sm">
                    <span>{item.product.name}</span>
                    <span className="text-gray-600">Qty: {item.quantity}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total Weight:</span>
                  <span>{packageData.totalWeight} kg</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Complete Button */}
        <Button
          onClick={handleCompleteDelivery}
          disabled={completing}
          size="lg"
          className="w-full text-lg py-6"
        >
          {completing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Completing Delivery...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-5 w-5" />
              Complete Delivery
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
