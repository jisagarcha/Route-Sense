'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Truck, Package as PackageIcon, Award, CheckCircle, Loader2 } from 'lucide-react';

interface DriverProfile {
  vehicleType: string;
  maxCapacity: number;
  maxVolume: number;
  experienceYears: number;
  rating: number;
  totalDeliveries: number;
  isAvailable: boolean;
}

interface DriverRecommendation {
  driverId: string;
  driverName: string;
  driverEmail: string;
  matchScore: number;
  reasons: string[];
  profile: DriverProfile;
}

interface DriverRecommendationsProps {
  packageId: string;
  packageData: {
    totalWeight: number;
    totalVolume: number;
    isCritical: boolean;
    deliveryLat: number;
    deliveryLong: number;
  };
}

export function DriverRecommendations({ packageId, packageData }: DriverRecommendationsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<DriverRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('/api/recommendations/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight: packageData.totalWeight,
          volume: packageData.totalVolume,
          isCritical: packageData.isCritical,
          deliveryLat: packageData.deliveryLat,
          deliveryLong: packageData.deliveryLong
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setRecommendations(data.recommendations);
      } else {
        setError(data.error || 'Failed to get recommendations');
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDriver = async (driverId: string) => {
    setAssigning(driverId);
    try {
      const res = await fetch(`/api/packages/${packageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId })
      });

      if (res.ok) {
        router.push('/packages');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to assign driver');
      }
    } catch (err) {
      console.error('Error assigning driver:', err);
      alert('Failed to assign driver');
    } finally {
      setAssigning(null);
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getMatchScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-50 border-green-200';
    if (score >= 75) return 'bg-blue-50 border-blue-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-gray-50 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Finding best drivers for your package...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <Button onClick={fetchRecommendations} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No available drivers found for this package.</p>
        <Button onClick={() => router.push('/packages')} className="mt-4">
          Back to Packages
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">AI-Powered Driver Recommendations</h2>
        <p className="text-gray-600">
          Found {recommendations.length} drivers matched to your package requirements
        </p>
      </div>

      <div className="grid gap-4">
        {recommendations.map((rec, index) => (
          <Card key={rec.driverId} className={`border-2 ${getMatchScoreBg(rec.matchScore)}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {index === 0 && (
                      <Badge variant="default" className="bg-yellow-500">
                        <Award className="h-3 w-3 mr-1" />
                        Top Match
                      </Badge>
                    )}
                    <CardTitle className="text-xl">{rec.driverName}</CardTitle>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      {rec.profile.vehicleType}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {rec.profile.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      {rec.profile.totalDeliveries} deliveries
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getMatchScoreColor(rec.matchScore)}`}>
                    {Math.round(rec.matchScore)}%
                  </div>
                  <div className="text-sm text-gray-500">Match Score</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Driver Details</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Experience:</span>
                      <span className="font-medium">{rec.profile.experienceYears} years</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Capacity:</span>
                      <span className="font-medium">{rec.profile.maxCapacity} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Volume:</span>
                      <span className="font-medium">{rec.profile.maxVolume} cu ft</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Deliveries:</span>
                      <span className="font-medium">{rec.profile.totalDeliveries}</span>
                    </div>
                    {rec.profile.isAvailable && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Available Now
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Why This Driver?</h4>
                  <ul className="text-sm space-y-1">
                    {rec.reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <Button
                onClick={() => handleAssignDriver(rec.driverId)}
                disabled={assigning !== null}
                className="w-full"
                size="lg"
              >
                {assigning === rec.driverId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <PackageIcon className="mr-2 h-4 w-4" />
                    Assign to {rec.driverName}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => router.push('/packages')}>
          Skip Assignment for Now
        </Button>
      </div>
    </div>
  );
}
