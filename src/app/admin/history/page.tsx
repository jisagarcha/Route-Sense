'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RouteRequest {
  id: number;
  sourceLocation: { name: string };
  targetLocation: { name: string };
  totalDistance: number;
  pathLocations: string[];
  createdAt: string;
}

export default function HistoryPage() {
  const [routes, setRoutes] = useState<RouteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await fetch('/api/route-history');
      const data = await response.json();
      setRoutes(data.routeRequests || []);
    } catch (err) {
      console.error('Failed to fetch route history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">📜 Route History</h1>
        <p className="text-muted-foreground">
          View all past route computations and their details
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Route Requests</CardTitle>
          <CardDescription>
            {routes.length} route{routes.length !== 1 ? 's' : ''} computed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Distance (km)</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No route history found. Compute your first route to see it here.
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell>{route.id}</TableCell>
                      <TableCell className="font-medium">{route.sourceLocation.name}</TableCell>
                      <TableCell className="font-medium">{route.targetLocation.name}</TableCell>
                      <TableCell>{route.totalDistance.toFixed(2)}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {route.pathLocations.join(' → ')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(route.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
