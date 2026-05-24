'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { MapPin, Route, TrendingUp, Clock, Shield, Zap, Navigation, BarChart3 } from 'lucide-react';

interface Location {
  id: number;
  name: string;
}

export default function Home() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations');
        const data = await response.json();
        setLocations(data.locations || []);
      } catch (err) {
        console.error('Error fetching locations:', err);
      }
    };

    fetchLocations();
  }, []);

  const handleFindRoute = () => {
    if (!sourceId || !targetId) {
      setError('Please select both source and destination');
      return;
    }

    if (sourceId === targetId) {
      setError('Source and destination cannot be the same');
      return;
    }

    setError('');
    // Redirect to results page with query params
    router.push(`/results?source=${sourceId}&target=${targetId}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section with Background */}
      <div 
        className="relative min-h-[90vh] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/ktm-bg.avif')" }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
        
        {/* Content */}
        <div className="relative container mx-auto px-4 py-16 flex items-center min-h-[90vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
            
            {/* Left Section - Title & Tagline */}
            <div className="text-white space-y-6">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                  Smart Routes,
                  <span className="block text-primary">Faster Deliveries</span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-200 leading-relaxed max-w-2xl">
                  Optimize your delivery operations with intelligent routing algorithms. 
                  Save time, reduce costs, and deliver excellence.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-4 pt-4">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
                  <Route className="h-5 w-5 text-primary" />
                  <span className="font-medium">Smart Routing</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-medium">Real-time Updates</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="font-medium">Data Insights</span>
                </div>
              </div>
            </div>

            {/* Right Section - Route Planner Card */}
            <div className="flex justify-center lg:justify-end">
              <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
                <CardHeader className="text-white">
                  <CardTitle className="text-2xl">Find Your Route</CardTitle>
                  <CardDescription className="text-gray-200">
                    Select locations to compute the optimal path
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="source" className="text-white font-medium text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Source Location
                    </Label>
                    <Select value={sourceId} onValueChange={setSourceId}>
                      <SelectTrigger 
                        id="source" 
                        className="bg-white border-2 border-white/50 text-gray-900 h-12 text-base font-medium"
                      >
                        <SelectValue placeholder="Select starting point" className="text-gray-500" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {locations.map((loc) => (
                          <SelectItem 
                            key={loc.id} 
                            value={loc.id.toString()}
                            className="text-gray-900 font-medium cursor-pointer"
                          >
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="target" className="text-white font-medium text-base flex items-center gap-2">
                      <Navigation className="h-4 w-4" />
                      Destination Location
                    </Label>
                    <Select value={targetId} onValueChange={setTargetId}>
                      <SelectTrigger 
                        id="target" 
                        className="bg-white border-2 border-white/50 text-gray-900 h-12 text-base font-medium"
                      >
                        <SelectValue placeholder="Select destination" className="text-gray-500" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {locations.map((loc) => (
                          <SelectItem 
                            key={loc.id} 
                            value={loc.id.toString()}
                            className="text-gray-900 font-medium cursor-pointer"
                          >
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleFindRoute}
                    disabled={!sourceId || !targetId}
                    style={{ backgroundColor: '#bb2133' }}
                    className="w-full h-14 text-lg font-bold text-white hover:opacity-90 shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    Find Best Route
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="container mx-auto px-4 py-4">
          <Alert variant="destructive" className="max-w-4xl mx-auto">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Choose RouteSense?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to optimize your delivery operations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            <Card className="border-2 hover:border-primary hover:shadow-lg transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Lightning Fast</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Dijkstra&apos;s algorithm computes optimal routes in milliseconds, even for complex networks.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary hover:shadow-lg transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Smart Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track patterns, analyze historical data, and make data-driven decisions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary hover:shadow-lg transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Reliable & Secure</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Enterprise-grade reliability with secure data handling and backup systems.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary hover:shadow-lg transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Cost Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Reduce fuel costs and delivery time by up to 30% with optimized routing.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto text-center">
            <div className="space-y-2">
              <p className="text-5xl font-bold">{locations.length}</p>
              <p className="text-sm opacity-90">Active Locations</p>
            </div>
            <div className="space-y-2">
              <p className="text-5xl font-bold">100%</p>
              <p className="text-sm opacity-90">Accuracy Rate</p>
            </div>
            <div className="space-y-2">
              <p className="text-5xl font-bold">30%</p>
              <p className="text-sm opacity-90">Cost Reduction</p>
            </div>
            <div className="space-y-2">
              <p className="text-5xl font-bold">24/7</p>
              <p className="text-sm opacity-90">Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Location Cards Preview */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Available Locations</h2>
            <p className="text-xl text-muted-foreground">
              Covering major delivery points across the region
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {locations.slice(0, 8).map((location) => (
              <Card 
                key={location.id} 
                className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-2 hover:border-primary"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{location.name}</h3>
                      <p className="text-sm text-muted-foreground">Location ID: {location.id}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {locations.length > 8 && (
            <div className="text-center mt-8">
              <Button variant="outline" size="lg" asChild>
                <a href="/admin/locations">
                  View All {locations.length} Locations →
                </a>
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
