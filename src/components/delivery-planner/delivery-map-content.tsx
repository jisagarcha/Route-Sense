"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useLeafletSetup } from "@/lib/map-utils";
import type { DeliveryMapProps } from "./delivery-map";

const DEFAULT_CENTER: [number, number] = [27.7172, 85.324];

function FitBounds({ positions }: { positions: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }

    map.fitBounds(positions, { padding: [48, 48], maxZoom: 15 });
  }, [map, positions]);

  return null;
}

function createPin(color: string, label: string, active = false) {
  const size = active ? 36 : 30;
  return L.divIcon({
    className: "routesense-pin",
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:9999px;
        background:${color};
        color:white;
        border:${active ? 4 : 3}px solid white;
        box-shadow:0 10px 24px rgba(15,23,42,.28);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:800;
        outline:${active ? "3px solid rgba(37,99,235,.35)" : "none"};
      ">${label}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function DeliveryMapContent({
  depot,
  stops,
  route,
  activeStopId,
  livePosition,
}: DeliveryMapProps) {
  useLeafletSetup();

  const orderedStops = route?.orderedStops?.length ? route.orderedStops : stops;
  const routeLine = route?.geometry.coordinates.length
    ? route.geometry.coordinates
    : [
        [depot.lat, depot.lng] as [number, number],
        ...orderedStops.map((stop) => [stop.lat, stop.lng] as [number, number]),
      ];

  const boundsPositions = useMemo(() => {
    const positions: Array<[number, number]> = [[depot.lat, depot.lng]];
    for (const stop of stops) positions.push([stop.lat, stop.lng]);
    if (livePosition) positions.push([livePosition.lat, livePosition.lng]);
    return positions;
  }, [depot.lat, depot.lng, livePosition, stops]);

  return (
    <MapContainer
      center={boundsPositions[0] || DEFAULT_CENTER}
      zoom={13}
      className="h-full min-h-[420px] w-full"
      style={{ height: "100%", width: "100%", backgroundColor: "#f8fafc" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds positions={boundsPositions} />

      {routeLine.length > 1 && (
        <Polyline positions={routeLine} color="#2563eb" weight={5} opacity={0.82} />
      )}

      <Marker position={[depot.lat, depot.lng]} icon={createPin("#16A34A", "S")}>
        <Popup>
          <div className="text-sm">
            <p className="font-semibold">Start</p>
            <p className="text-slate-600">
              {depot.lat.toFixed(5)}, {depot.lng.toFixed(5)}
            </p>
          </div>
        </Popup>
      </Marker>

      {orderedStops.map((stop, index) => {
        const isActive = stop.id === activeStopId;
        const color =
          stop.status === "COMPLETED"
            ? "#2563EB"
            : stop.priority === "HIGH"
              ? "#D97706"
              : stop.status === "FAILED"
                ? "#DC2626"
                : "#DC2626";

        return (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={createPin(color, String(index + 1), isActive)}
          >
            <Popup>
              <div className="max-w-[220px] text-sm">
                <p className="font-semibold">{stop.recipientName || `Stop ${index + 1}`}</p>
                <p className="text-slate-700">{stop.resolvedAddress || stop.address}</p>
                {stop.estimatedArrivalLabel && (
                  <p className="mt-1 text-xs text-slate-500">ETA {stop.estimatedArrivalLabel}</p>
                )}
                {stop.notes && <p className="mt-1 text-xs text-slate-500">{stop.notes}</p>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {livePosition && (
        <CircleMarker
          center={[livePosition.lat, livePosition.lng]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#2563EB",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">Live position</p>
              {livePosition.accuracy && (
                <p className="text-slate-600">Accuracy {Math.round(livePosition.accuracy)} m</p>
              )}
            </div>
          </Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
