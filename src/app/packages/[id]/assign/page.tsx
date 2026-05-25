'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DriverRecommendations } from '@/components/packages/driver-recommendations';
import { AlertTriangle, Edit, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PackageData {
  id: string;
  packageName: string;
  totalWeight: number;
  totalVolume: number;
  isCritical: boolean;
  deliveryLat: number | null;
  deliveryLong: number | null;
  routeId?: string | null;
  totalDistance?: number | null;
  warehouseLat?: number | null;
  warehouseLong?: number | null;
}

export default function AssignDriverPage() {
  const params = useParams();
  const router = useRouter();
  const packageId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPackage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId]);

  const fetchPackage = async () => {
    try {
      const res = await fetch(`/api/packages/${packageId}`);
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

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !packageData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-red-600">{error || 'Package not found'}</p>
        </div>
      </div>
    );
  }

  const hasOptimizedRoute = Boolean(packageData.routeId || packageData.totalDistance);
  const hasDeliveryCoordinates = packageData.deliveryLat !== null && packageData.deliveryLong !== null;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Assign Driver</h1>
            <p className="text-gray-600">Package: {packageData.packageName}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/packages/${packageId}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Re-edit details
          </Button>
        </div>

        {!hasOptimizedRoute && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-900">
              No route optimized yet. A best-effort route will be auto-calculated at dispatch time using the delivery address.
            </AlertDescription>
          </Alert>
        )}

        {!hasDeliveryCoordinates && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-900">
              Delivery coordinates are missing. Driver assignment is still available, but route calculation may need package details to be updated.
            </AlertDescription>
          </Alert>
        )}
        
        <DriverRecommendations
          packageId={packageId}
          packageData={{
            totalWeight: packageData.totalWeight,
            totalVolume: packageData.totalVolume,
            isCritical: packageData.isCritical,
            deliveryLat: packageData.deliveryLat,
            deliveryLong: packageData.deliveryLong,
            warehouseLat: packageData.warehouseLat ?? null,
            warehouseLong: packageData.warehouseLong ?? null,
          }}
        />
      </div>
    </div>
  );
}
