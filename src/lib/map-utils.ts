"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Next.js
export function useLeafletSetup() {
  useEffect(() => {
    // @ts-expect-error - Leaflet Icon default path fix
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);
}

// Custom marker icons
export const createCustomIcon = (color: string = "#bb2133", label?: string) => {
  return L.divIcon({
    className: "custom-icon",
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        border: 3px solid white;
        transform: rotate(-45deg);
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${label ? `<span style="transform: rotate(45deg); color: white; font-weight: bold; font-size: 12px;">${label}</span>` : ''}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

export const startIcon = createCustomIcon("#22c55e", "S");
export const endIcon = createCustomIcon("#ef4444", "E");
export const waypointIcon = createCustomIcon("#3b82f6");
export const defaultIcon = createCustomIcon("#bb2133");
