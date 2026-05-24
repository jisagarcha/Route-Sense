'use client';

import { useCallback, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Route, Navigation, BarChart3, ArrowLeft, Share2, Download, RefreshCw, Clock, TrendingDown } from 'lucide-react';

interface RouteResult {
  path: Array<{ id: number; name: string }>;
  totalDistance: number;
  hops: number;
  sourceLocation: string;
  targetLocation: string;
}

interface SimilarRoute {
  routeId: number;
  path: string[];
  totalDistance: number;
  similarity: number;
  similarityPercentage: string;
  sourceLocation: string;
  targetLocation: string;
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [similarRoutes, setSimilarRoutes] = useState<SimilarRoute[]>([]);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState(0);

  const sourceId = searchParams.get('source');
  const targetId = searchParams.get('target');

  const fetchRoute = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/shortest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLocationId: parseInt(sourceId!),
          targetLocationId: parseInt(targetId!),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to compute route');
        return;
      }

      if (!data.found) {
        setError(data.message || 'No route found');
        return;
      }

      setResult(data.route);
      setSimilarRoutes(data.similarRoutes || []);
      // Estimate time: assuming avg speed of 40 km/h
      setEstimatedTime(Math.round((data.route.totalDistance / 40) * 60));
    } catch (err) {
      setError('An error occurred while computing the route');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sourceId, targetId]);

  useEffect(() => {
    if (sourceId && targetId) {
      fetchRoute();
    } else {
      setError('Invalid route parameters');
      setLoading(false);
    }
  }, [fetchRoute, sourceId, targetId]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    
    const routeData = {
      source: result.sourceLocation,
      destination: result.targetLocation,
      distance: `${result.totalDistance.toFixed(2)} km`,
      stops: result.hops,
      estimatedTime: `${estimatedTime} minutes`,
      path: result.path.map(loc => loc.name),
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(routeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-${result.sourceLocation}-to-${result.targetLocation}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">Computing Your Route</p>
                <p className="text-sm text-muted-foreground mt-1">Using Dijkstra&apos;s Algorithm...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
        <div className="container mx-auto max-w-2xl pt-20">
          <Alert variant="destructive">
            <AlertDescription className="text-base">{error}</AlertDescription>
          </Alert>
          <div className="mt-6 text-center">
            <Button onClick={() => router.push('/')} variant="outline" size="lg">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const fuelCost = (result.totalDistance * 0.15).toFixed(2); // Assuming $0.15 per km
  const co2Saved = (result.totalDistance * 0.12).toFixed(2); // kg of CO2

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button onClick={() => router.push('/')} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button onClick={handleShare} variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                {copied ? 'Copied!' : 'Share'}
              </Button>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button onClick={fetchRoute} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Success Banner */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-6 py-3 rounded-full mb-4">
            <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
            <span className="font-semibold">Route Successfully Computed!</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">Your Optimal Route</h1>
          <p className="text-muted-foreground text-lg">
            From <span className="text-primary font-semibold">{result.sourceLocation}</span> to{' '}
            <span className="text-primary font-semibold">{result.targetLocation}</span>
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 hover:shadow-lg transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Navigation className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Distance</p>
                  <p className="text-2xl font-bold">{result.totalDistance.toFixed(2)} km</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:shadow-lg transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stops</p>
                  <p className="text-2xl font-bold">{result.hops}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:shadow-lg transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Est. Time</p>
                  <p className="text-2xl font-bold">{estimatedTime} min</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:shadow-lg transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fuel Cost</p>
                  <p className="text-2xl font-bold">${fuelCost}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Route Path */}
        <Card className="mb-8 border-2 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Route className="h-6 w-6 text-primary" />
              Route Path
            </CardTitle>
            <CardDescription className="text-base">
              Optimized using Dijkstra&apos;s Algorithm (Complexity: O(V² + E))
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              {result.path.map((location, index) => (
                <div key={location.id} className="flex items-center">
                  <div className="relative">
                    <div className="bg-primary text-primary-foreground px-6 py-3 rounded-xl text-base font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer">
                      {location.name}
                    </div>
                    {index === 0 && (
                      <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        Start
                      </span>
                    )}
                    {index === result.path.length - 1 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        End
                      </span>
                    )}
                  </div>
                  {index < result.path.length - 1 && (
                    <div className="mx-4 flex items-center">
                      <div className="h-0.5 w-8 bg-primary" />
                      <div className="h-3 w-3 rotate-45 border-t-2 border-r-2 border-primary -ml-2" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Environmental Impact */}
            <div className="mt-8 p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  🌱
                </div>
                <p className="font-semibold text-green-900">Environmental Impact</p>
              </div>
              <p className="text-sm text-green-800">
                This optimized route helps save approximately <span className="font-bold">{co2Saved} kg</span> of CO₂ emissions compared to non-optimized routes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Similar Routes */}
        {similarRoutes.length > 0 && (
          <Card className="border-2 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
              <CardTitle className="text-2xl flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Similar Past Routes
              </CardTitle>
              <CardDescription className="text-base">
                Based on cosine similarity of visited locations
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {similarRoutes.map((route, idx) => (
                  <div
                    key={route.routeId}
                    className="border-2 rounded-xl p-5 hover:border-primary hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-lg">Route #{route.routeId}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <MapPin className="h-4 w-4" />
                            {route.sourceLocation} → {route.targetLocation}
                          </p>
                        </div>
                      </div>
                      <div className="text-right bg-primary/10 px-4 py-2 rounded-lg">
                        <p className="text-2xl font-bold text-primary">
                          {route.similarityPercentage}
                        </p>
                        <p className="text-xs text-muted-foreground">match</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mb-2">
                      <Route className="h-4 w-4 flex-shrink-0" />
                      <span className="line-clamp-1">{route.path.join(' → ')}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-primary" />
                        Distance: <span className="font-semibold text-primary">{route.totalDistance.toFixed(2)} km</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Call to Action */}
        <div className="mt-8 text-center">
          <Button onClick={() => router.push('/')} size="lg" style={{ backgroundColor: '#bb2133' }} className="text-white hover:opacity-90">
            Plan Another Route
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-16 w-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
