"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLeafletSetup } from "@/lib/map-utils";

interface MapLocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  label: string;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  height?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

const DEFAULT_CENTER: [number, number] = [27.7, 85.3];

const selectedIcon = L.divIcon({
  className: "routesense-location-picker-pin",
  html: `
    <div style="
      width:32px;
      height:32px;
      border-radius:999px;
      background:#dc2626;
      border:4px solid white;
      box-shadow:0 10px 24px rgba(15,23,42,.32);
    "></div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export default function MapLocationPicker({
  initialLat,
  initialLng,
  label,
  onLocationSelect,
  height = "400px",
}: MapLocationPickerProps) {
  useLeafletSetup();
  const hasInitialLocation = Number.isFinite(initialLat) && Number.isFinite(initialLng);
  const [selected, setSelected] = useState<[number, number]>(
    hasInitialLocation ? [Number(initialLat), Number(initialLng)] : DEFAULT_CENTER
  );
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasInitialLocation) {
      const nextSelected: [number, number] = [Number(initialLat), Number(initialLng)];
      setSelected(nextSelected);
      void reverseGeocode(nextSelected[0], nextSelected[1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLng]);

  const center = useMemo<[number, number]>(() => selected, [selected]);

  const handleSelect = async (lat: number, lng: number) => {
    setSelected([lat, lng]);
    await reverseGeocode(lat, lng);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: "json",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
      const data = await response.json();
      if (mountedRef.current) {
        setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (error) {
      console.warn("Reverse geocoding failed:", error);
      if (mountedRef.current) {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } finally {
      if (mountedRef.current) {
        setGeocoding(false);
      }
    }
  };

  const searchAddress = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: "5",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("Forward geocoding failed:", error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (result: NominatimResult) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setSelected([lat, lng]);
    setAddress(result.display_name);
    setQuery(result.display_name);
    setResults([]);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchAddress();
              }
            }}
            placeholder="Search an address or place"
            className="pr-28 pl-10"
          />
          <Button
            type="button"
            size="sm"
            onClick={searchAddress}
            disabled={searching || !query.trim()}
            className="absolute right-1 top-1/2 h-8 -translate-y-1/2"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        {results.length > 0 && (
          <div className="overflow-hidden rounded-md border bg-white shadow-sm">
            {results.map((result) => (
              <button
                type="button"
                key={`${result.lat}-${result.lon}-${result.display_name}`}
                onClick={() => selectSearchResult(result)}
                className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-gray-50 last:border-b-0"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200" style={{ height }}>
        <MapContainer
          center={center}
          zoom={hasInitialLocation ? 14 : 13}
          className="h-full w-full"
          preferCanvas={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={handleSelect} />
          <SyncSelectedView selected={selected} />
          <Marker
            position={selected}
            icon={selectedIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as L.Marker;
                const position = marker.getLatLng();
                void handleSelect(position.lat, position.lng);
              },
            }}
          />
        </MapContainer>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        <div className="mb-1 flex items-center gap-2 font-medium text-gray-900">
          <MapPin className="h-4 w-4 text-red-600" />
          Selected location
        </div>
        <p>{geocoding ? "Resolving address..." : address || "Click the map or search to select an address."}</p>
        <p className="mt-1 text-xs text-gray-500">
          {selected[0].toFixed(6)}, {selected[1].toFixed(6)}
        </p>
      </div>

      <Button
        type="button"
        onClick={() => onLocationSelect(selected[0], selected[1], address || `${selected[0]}, ${selected[1]}`)}
        className="w-full"
      >
        Confirm Location
      </Button>
    </div>
  );
}

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => onSelect(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

function SyncSelectedView({ selected }: { selected: [number, number] }) {
  const map = useMap();
  const didInitialSync = useRef(false);

  useEffect(() => {
    if (!map) return;

    const zoom = Math.max(map.getZoom(), 14);
    if (!didInitialSync.current) {
      didInitialSync.current = true;
      map.setView(selected, zoom, { animate: false });
      return;
    }

    map.setView(selected, zoom, { animate: false });
  }, [map, selected]);

  return null;
}
