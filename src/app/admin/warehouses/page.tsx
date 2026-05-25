"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MapLocationPicker = dynamic(() => import("@/components/MapLocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-md bg-gray-100" />,
});

interface Warehouse {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  _count?: { routes: number };
}

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    address: "",
    lat: "27.7172",
    lng: "85.3120",
  });

  useEffect(() => {
    void fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    setError("");
    try {
      const response = await fetch("/api/warehouses");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch warehouses");
      setWarehouses(data.warehouses || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch warehouses");
    } finally {
      setLoading(false);
    }
  };

  const createWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          lat: Number(form.lat),
          lng: Number(form.lng),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create warehouse");
      setForm({ name: "", address: "", lat: "27.7172", lng: "85.3120" });
      await fetchWarehouses();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to create warehouse");
    } finally {
      setSaving(false);
    }
  };

  const deleteWarehouse = async (id: string) => {
    if (!confirm("Delete this warehouse? Routes attached to it must be moved first.")) return;
    setError("");
    try {
      const response = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete warehouse");
      setWarehouses((current) => current.filter((warehouse) => warehouse.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete warehouse");
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Building2 className="h-7 w-7 text-blue-600" />
          Warehouses
        </h1>
        <p className="text-gray-600">Create warehouse origins by clicking on the map.</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Add Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createWarehouse} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                  required
                />
              </div>
              <MapLocationPicker
                label="Warehouse location"
                initialLat={Number(form.lat)}
                initialLng={Number(form.lng)}
                height="360px"
                onLocationSelect={(lat, lng, address) =>
                  setForm({
                    ...form,
                    lat: String(lat),
                    lng: String(lng),
                    address: address || form.address,
                  })
                }
              />
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Warehouse
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Warehouses</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : warehouses.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-gray-500">
                No warehouses created yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {warehouses.map((warehouse) => (
                  <div key={warehouse.id} className="rounded-md border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{warehouse.name}</h2>
                        <p className="mt-1 text-sm text-gray-600">{warehouse.address}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {warehouse.lat.toFixed(5)}, {warehouse.lng.toFixed(5)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {warehouse._count?.routes || 0} routes
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => deleteWarehouse(warehouse.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
