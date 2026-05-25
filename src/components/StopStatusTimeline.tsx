"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface StopStatusTimelineProps {
  packageId: string;
}

interface PackageTimelineData {
  status: string;
  createdAt: string;
  updatedAt: string;
  collectedAt?: string | null;
  deliveredAt?: string | null;
  driver?: { name: string | null; email: string } | null;
  delivery?: { startedAt?: string | null; completedAt?: string | null } | null;
}

export function StopStatusTimeline({ packageId }: StopStatusTimelineProps) {
  const [pkg, setPkg] = useState<PackageTimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPackage() {
      try {
        const response = await fetch(`/api/packages/${packageId}`);
        const data = await response.json();
        if (!cancelled && response.ok) {
          setPkg(data.package);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchPackage();
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading timeline
      </div>
    );
  }

  if (!pkg) {
    return <p className="text-sm text-gray-500">Timeline unavailable.</p>;
  }

  const steps = [
    {
      label: "Package Created",
      complete: true,
      detail: formatDate(pkg.createdAt),
    },
    {
      label: "Assigned to Driver",
      complete: Boolean(pkg.driver),
      detail: pkg.driver ? `${formatDate(pkg.updatedAt)} (${pkg.driver.name || pkg.driver.email})` : "Awaiting assignment",
    },
    {
      label: "Collected from Warehouse",
      complete: Boolean(pkg.collectedAt) || ["COLLECTED_FROM_WAREHOUSE", "IN_TRANSIT", "DELIVERED"].includes(pkg.status),
      detail: pkg.collectedAt ? formatDate(pkg.collectedAt) : "Awaiting pickup",
    },
    {
      label: "In Transit",
      complete: ["IN_TRANSIT", "DELIVERED"].includes(pkg.status),
      detail: pkg.delivery?.startedAt ? formatDate(pkg.delivery.startedAt) : "Not started",
    },
    {
      label: "Delivered",
      complete: pkg.status === "DELIVERED",
      detail: pkg.deliveredAt || pkg.delivery?.completedAt ? formatDate(pkg.deliveredAt || pkg.delivery?.completedAt) : "Pending",
    },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const Icon = step.complete ? CheckCircle2 : Circle;
        return (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Icon className={step.complete ? "h-5 w-5 text-green-600" : "h-5 w-5 text-gray-300"} />
              {index < steps.length - 1 && <div className="mt-1 h-8 w-px bg-gray-200" />}
            </div>
            <div className="pb-3">
              <p className="text-sm font-semibold text-gray-900">{step.label}</p>
              <p className="text-xs text-gray-500">{step.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Pending";
  return new Date(value).toLocaleString();
}
