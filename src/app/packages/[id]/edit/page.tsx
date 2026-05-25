"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MapLocationPicker = dynamic(() => import("@/components/MapLocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[400px] animate-pulse rounded-md bg-gray-100" />,
});

interface PackageData {
  id: string;
  packageName: string;
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLong: number | null;
  totalWeight: number;
  notes: string | null;
  priority?: "HIGH" | "NORMAL" | "LOW";
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
}

export default function EditPackagePage() {
  const params = useParams();
  const router = useRouter();
  const packageId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    packageName: "",
    recipientName: "",
    recipientPhone: "",
    deliveryAddress: "",
    deliveryLat: "",
    deliveryLong: "",
    totalWeight: "",
    notes: "",
    priority: "NORMAL",
    timeWindowStart: "",
    timeWindowEnd: "",
  });

  useEffect(() => {
    void fetchPackage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId]);

  const fetchPackage = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/packages/${packageId}`);
      const data = await response.json();

      if (!response.ok || !data.package) {
        throw new Error(data.error || "Package not found");
      }

      const pkg = data.package as PackageData;
      setForm({
        packageName: pkg.packageName || "",
        recipientName: pkg.recipientName || "",
        recipientPhone: pkg.recipientPhone || "",
        deliveryAddress: pkg.deliveryAddress || "",
        deliveryLat: pkg.deliveryLat?.toString() || "",
        deliveryLong: pkg.deliveryLong?.toString() || "",
        totalWeight: pkg.totalWeight?.toString() || "",
        notes: pkg.notes || "",
        priority: pkg.priority || "NORMAL",
        timeWindowStart: toDateTimeLocal(pkg.timeWindowStart),
        timeWindowEnd: toDateTimeLocal(pkg.timeWindowEnd),
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load package");
    } finally {
      setLoading(false);
    }
  };

  const savePackage = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/packages/${packageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageName: form.packageName,
          recipientName: form.recipientName,
          recipientPhone: form.recipientPhone,
          deliveryAddress: form.deliveryAddress,
          deliveryLat: form.deliveryLat ? Number(form.deliveryLat) : null,
          deliveryLong: form.deliveryLong ? Number(form.deliveryLong) : null,
          deliveryLng: form.deliveryLong ? Number(form.deliveryLong) : null,
          totalWeight: form.totalWeight ? Number(form.totalWeight) : undefined,
          notes: form.notes,
          priority: form.priority,
          timeWindowStart: form.timeWindowStart || null,
          timeWindowEnd: form.timeWindowEnd || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update package");
      }

      router.push(`/packages/${packageId}/assign`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update package");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Edit Package Details</h1>
            <p className="text-gray-600">Update delivery information before driver assignment.</p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/packages/${packageId}/assign`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={savePackage} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
          <Card>
            <CardHeader>
              <CardTitle>Package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="packageName">Package name</Label>
                <Input
                  id="packageName"
                  value={form.packageName}
                  onChange={(event) => setForm({ ...form, packageName: event.target.value })}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Recipient name</Label>
                  <Input
                    id="recipientName"
                    value={form.recipientName}
                    onChange={(event) => setForm({ ...form, recipientName: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipientPhone">Recipient phone</Label>
                  <Input
                    id="recipientPhone"
                    value={form.recipientPhone}
                    onChange={(event) => setForm({ ...form, recipientPhone: event.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="totalWeight">Weight (kg)</Label>
                  <Input
                    id="totalWeight"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.totalWeight}
                    onChange={(event) => setForm({ ...form, totalWeight: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="HIGH">High</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timeWindowStart">Time window start</Label>
                  <Input
                    id="timeWindowStart"
                    type="datetime-local"
                    value={form.timeWindowStart}
                    onChange={(event) => setForm({ ...form, timeWindowStart: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeWindowEnd">Time window end</Label>
                  <Input
                    id="timeWindowEnd"
                    type="datetime-local"
                    value={form.timeWindowEnd}
                    onChange={(event) => setForm({ ...form, timeWindowEnd: event.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryAddress">Delivery address</Label>
                <Input
                  id="deliveryAddress"
                  value={form.deliveryAddress}
                  onChange={(event) => setForm({ ...form, deliveryAddress: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Details
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery Location</CardTitle>
            </CardHeader>
            <CardContent>
              <MapLocationPicker
                label="Delivery location"
                initialLat={form.deliveryLat ? Number(form.deliveryLat) : undefined}
                initialLng={form.deliveryLong ? Number(form.deliveryLong) : undefined}
                onLocationSelect={(lat, lng, address) =>
                  setForm({
                    ...form,
                    deliveryLat: String(lat),
                    deliveryLong: String(lng),
                    deliveryAddress: address,
                  })
                }
              />
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
