"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { GeoPoint } from "@/lib/delivery-routing";
import { LivePosition } from "./use-geolocation";
import { OptimizedRoute, PlannerStop } from "./types";

export interface DeliveryMapProps {
  depot: GeoPoint;
  stops: PlannerStop[];
  route: OptimizedRoute | null;
  activeStopId?: string | null;
  livePosition?: LivePosition | null;
}

const DeliveryMapContent = dynamic(() => import("./delivery-map-content"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center bg-slate-100">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-600">Loading map</p>
      </div>
    </div>
  ),
});

export function DeliveryMap(props: DeliveryMapProps) {
  return <DeliveryMapContent {...props} />;
}
