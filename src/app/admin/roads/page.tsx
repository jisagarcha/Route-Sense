'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Location {
  id: number;
  name: string;
}

interface Road {
  id: number;
  fromLocationId: number;
  toLocationId: number;
  distance: number;
  isBidirectional: boolean;
  fromLocation: Location;
  toLocation: Location;
}

export default function RoadsPage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    fromLocationId: '',
    toLocationId: '',
    distance: '',
    isBidirectional: 'false',
  });

  useEffect(() => {
    fetchRoads();
    fetchLocations();
  }, []);

  const fetchRoads = async () => {
    try {
      const response = await fetch('/api/roads');
      const data = await response.json();
      setRoads(data.roads || []);
    } catch (err) {
      setError('Failed to fetch roads');
      console.error(err);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        fromLocationId: parseInt(formData.fromLocationId),
        toLocationId: parseInt(formData.toLocationId),
        distance: parseFloat(formData.distance),
        isBidirectional: formData.isBidirectional === 'true',
      };

      const url = editingId ? `/api/roads/${editingId}` : '/api/roads';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { distance: payload.distance, isBidirectional: payload.isBidirectional } : payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save road');
        return;
      }

      setSuccess(editingId ? 'Road updated successfully' : 'Road created successfully');
      setFormData({ fromLocationId: '', toLocationId: '', distance: '', isBidirectional: 'false' });
      setIsAdding(false);
      setEditingId(null);
      fetchRoads();
    } catch (err) {
      setError('An error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (road: Road) => {
    setFormData({
      fromLocationId: road.fromLocationId.toString(),
      toLocationId: road.toLocationId.toString(),
      distance: road.distance.toString(),
      isBidirectional: road.isBidirectional.toString(),
    });
    setEditingId(road.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this road?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/roads/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete road');
        return;
      }

      setSuccess('Road deleted successfully');
      fetchRoads();
    } catch (err) {
      setError('An error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ fromLocationId: '', toLocationId: '', distance: '', isBidirectional: 'false' });
    setIsAdding(false);
    setEditingId(null);
    setError('');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🛣️ Manage Roads</h1>
        <p className="text-muted-foreground">
          Add, edit, or delete roads between locations (edges in the graph)
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {!isAdding && (
        <Button onClick={() => setIsAdding(true)} className="mb-6">
          + Add New Road
        </Button>
      )}

      {isAdding && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Road' : 'Add New Road'}</CardTitle>
            <CardDescription>
              {editingId ? 'Update road details' : 'Create a new road connection'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from">From Location *</Label>
                  <Select
                    value={formData.fromLocationId}
                    onValueChange={(value) => setFormData({ ...formData, fromLocationId: value })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger id="from">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id.toString()}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to">To Location *</Label>
                  <Select
                    value={formData.toLocationId}
                    onValueChange={(value) => setFormData({ ...formData, toLocationId: value })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger id="to">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id.toString()}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distance">Distance (km) *</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.distance}
                    onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                    placeholder="e.g., 5.5"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bidirectional">Direction</Label>
                  <Select
                    value={formData.isBidirectional}
                    onValueChange={(value) => setFormData({ ...formData, isBidirectional: value })}
                  >
                    <SelectTrigger id="bidirectional">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">One-way</SelectItem>
                      <SelectItem value="true">Two-way (Bidirectional)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Roads</CardTitle>
          <CardDescription>
            {roads.length} road{roads.length !== 1 ? 's' : ''} in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Distance (km)</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No roads found. Add your first road to connect locations.
                  </TableCell>
                </TableRow>
              ) : (
                roads.map((road) => (
                  <TableRow key={road.id}>
                    <TableCell>{road.id}</TableCell>
                    <TableCell className="font-medium">{road.fromLocation.name}</TableCell>
                    <TableCell className="font-medium">{road.toLocation.name}</TableCell>
                    <TableCell>{road.distance}</TableCell>
                    <TableCell>
                      {road.isBidirectional ? (
                        <span className="text-green-600">Two-way ↔</span>
                      ) : (
                        <span className="text-blue-600">One-way →</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(road)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(road.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
