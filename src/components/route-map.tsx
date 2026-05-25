"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Export with dynamic import of the actual leaflet content to avoid SSR "window is not defined" issues
export const RouteMap = dynamic(() => import("./route-map-content"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg bg-gray-100" style={{ width: "100%" }}>
      <div className="text-center">
        <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto mb-4" />
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});
