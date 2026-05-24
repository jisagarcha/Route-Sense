'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DriverRecommendations } from '@/components/packages/driver-recommendations';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PackageData {
  id: string;
  packageName: string;
  totalWeight: number;
  totalVolume: number;
  isCritical: boolean;
  deliveryLat: number | null;
  deliveryLong: number | null;
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

  // Check if package has delivery coordinates set
  if (packageData.deliveryLat === null || packageData.deliveryLong === null) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">
            This package needs route optimization before driver assignment.
          </p>
          <p className="text-gray-600 mb-6">
            Please complete the route optimization step to set delivery locations.
          </p>
          <Button onClick={() => router.push(`/packages/${packageId}/optimize`)}>
            Go to Route Optimization
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Assign Driver</h1>
          <p className="text-gray-600">Package: {packageData.packageName}</p>
        </div>
        
        <DriverRecommendations
          packageId={packageId}
          packageData={{
            totalWeight: packageData.totalWeight,
            totalVolume: packageData.totalVolume,
            isCritical: packageData.isCritical,
            deliveryLat: packageData.deliveryLat,
            deliveryLong: packageData.deliveryLong
          }}
        />
      </div>
    </div>
  );
}
