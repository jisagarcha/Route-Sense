"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import { useLeafletSetup, startIcon, endIcon, waypointIcon, defaultIcon } from "@/lib/map-utils";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Plus, Trash2 } from "lucide-react";
import L from "leaflet";

// Create numbered icon for route segments
const createNumberedIcon = (number: number) => {
  return L.divIcon({
    className: 'custom-numbered-icon',
    html: `<div style="
      background: #2563eb;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const createRouteStopIcon = (label: string, active = false, completed = false) => {
  const isWarehouse = /^w\d*$/i.test(label) || label.toLowerCase().includes("warehouse") || label.toLowerCase() === "start";
  const displayLabel = label.toLowerCase() === "start" ? "W1" : label;
  const size = isWarehouse ? 32 : active ? 34 : 28;
  const color = isWarehouse ? "#65000B" : completed ? "#16a34a" : active ? "#f97316" : "#2563eb";
  const borderRadius = isWarehouse ? "8px" : "9999px";
  return L.divIcon({
    className: "routesense-route-stop-icon",
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:${borderRadius};
      background:${color};
      color:white;
      border:2.5px solid white;
      box-shadow:0 8px 20px rgba(15,23,42,.32);
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:800;
      font-size:${isWarehouse ? "11px" : "12px"};
      letter-spacing:${isWarehouse ? "-0.5px" : "normal"};
    ">${displayLabel}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description?: string | null;
}

interface Road {
  id: number;
  fromLocationId: number;
  toLocationId: number;
  distance: number;
  isBidirectional: boolean;
}

interface RouteMapProps {
  locations: Location[];
  roads?: Road[];
  routePath?: number[]; // Array of location IDs
  stops?: Array<{
    id: string;
    lat: number;
    lng: number;
    label?: string;
    address?: string;
    status?: string;
  }>;
  polyline?: Array<[number, number]>;
  driverPosition?: { lat: number; lng: number } | null;
  driverPositions?: Array<{ id: string; name: string; lat: number; lng: number; recordedAt?: string }>;
  highlightedStopId?: string | null;
  onStopClick?: (stopId: string) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  editable?: boolean;
  onLocationAdd?: (lat: number, lng: number) => void;
  onRoadAdd?: (fromId: number, toId: number) => void;
  onLocationDelete?: (id: number) => void;
  onRoadDelete?: (id: number) => void;
}

// Component to handle map clicks
function MapClickHandler({ 
  editable, 
  onLocationAdd,
  isAddingLocation,
}: { 
  editable: boolean; 
  onLocationAdd?: (lat: number, lng: number) => void;
  isAddingLocation: boolean;
}) {
  useMapEvents({
    click: (e) => {
      if (editable && isAddingLocation && onLocationAdd) {
        onLocationAdd(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to handle map bounds
function MapBoundsHandler({ locations }: { locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 0);

    if (locations.length > 0) {
      const bounds = locations.map((loc) => [loc.latitude, loc.longitude] as [number, number]);
      if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds as [[number, number], [number, number]], { padding: [50, 50] });
      }
    }
  }, [locations, map]);

  return null;
}

export default function RouteMapContent({
  locations,
  roads = [],
  routePath = [],
  stops = [],
  polyline = [],
  driverPosition = null,
  driverPositions = [],
  highlightedStopId = null,
  onStopClick,
  center = [27.7172, 85.324], // Kathmandu
  zoom = 13,
  height = "600px",
  editable = false,
  onLocationAdd,
  onRoadAdd,
  onLocationDelete,
  onRoadDelete,
}: RouteMapProps) {
  useLeafletSetup();
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [editMode, setEditMode] = useState<"location" | "road" | null>(null);
  const [roadPolyline, setRoadPolyline] = useState<Array<[number, number]>>(polyline);

  const locationMap = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  );
  const routePathSet = useMemo(() => new Set(routePath), [routePath]);

  useEffect(() => {
    // If polyline has high resolution (many points), it is already a detailed road polyline
    if (polyline.length > Math.max(stops.length, 4)) {
      setRoadPolyline(polyline);
      return;
    }

    // Collect ordered points for road routing
    const points: Array<{ lat: number; lng: number }> = [];
    if (stops.length > 1) {
      stops.forEach((s) => {
        if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
          points.push({ lat: s.lat, lng: s.lng });
        }
      });
    } else if (routePath.length > 1) {
      routePath.forEach((id) => {
        const coords = locationMap.get(id);
        if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
          points.push({ lat: coords.latitude, lng: coords.longitude });
        }
      });
    } else if (polyline.length > 1) {
      polyline.forEach(([lat, lng]) => {
        points.push({ lat, lng });
      });
    }

    if (points.length < 2) {
      setRoadPolyline(polyline);
      return;
    }

    let isMounted = true;
    async function resolveShortestRoadRoute() {
      try {
        const res = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const coords = data.route?.coordinates;
        if (isMounted && Array.isArray(coords) && coords.length > 1) {
          setRoadPolyline(coords);
        }
      } catch (err) {
        console.warn("Could not fetch road geometry:", err);
      }
    }

    void resolveShortestRoadRoute();
    return () => {
      isMounted = false;
    };
  }, [polyline, routePath, stops, locationMap]);
  const boundsLocations = useMemo<Location[]>(() => {
    if (locations.length > 0) return locations;
    return [
      ...stops.map((stop, index) => ({
        id: index,
        name: stop.label || `Stop ${index + 1}`,
        latitude: stop.lat,
        longitude: stop.lng,
      })),
      ...polyline.map((point, index) => ({
        id: -1000 - index,
        name: `Route point ${index + 1}`,
        latitude: point[0],
        longitude: point[1],
      })),
      ...(driverPosition
        ? [{ id: -1, name: "Driver", latitude: driverPosition.lat, longitude: driverPosition.lng }]
        : []),
      ...driverPositions.map((driver, index) => ({
        id: -100 - index,
        name: driver.name,
        latitude: driver.lat,
        longitude: driver.lng,
      })),
    ];
  }, [driverPosition, driverPositions, locations, polyline, stops]);

  // Get location coordinates by ID
  const getLocationCoords = (id: number): [number, number] | null => {
    const loc = locationMap.get(id);
    return loc ? [loc.latitude, loc.longitude] : null;
  };

  // Handle location marker click in edit mode
  const handleLocationClick = (locationId: number) => {
    if (!editable) return;

    if (editMode === "road") {
      setSelectedLocations((prev) => {
        const newSelection = [...prev, locationId];
        if (newSelection.length === 2) {
          // Create road between two selected locations
          if (onRoadAdd) {
            onRoadAdd(newSelection[0], newSelection[1]);
          }
          return [];
        }
        return newSelection;
      });
    }
  };

  // Handle add location
  const handleAddLocation = (lat: number, lng: number) => {
    if (onLocationAdd) {
      onLocationAdd(lat, lng);
    }
    setIsAddingLocation(false);
    setEditMode(null);
  };

  // Draw roads as polylines
  const roadLines = roads.map((road) => {
    const from = getLocationCoords(road.fromLocationId);
    const to = getLocationCoords(road.toLocationId);
    if (!from || !to) return null;

    return (
      <Polyline
        key={road.id}
        positions={[from, to]}
        color="#3b82f6"
        weight={3}
        opacity={0.6}
        eventHandlers={{
          click: () => {
            if (editable && editMode === "road" && onRoadDelete) {
              if (confirm(`Delete road from ${locationMap.get(road.fromLocationId)?.name} to ${locationMap.get(road.toLocationId)?.name}?`)) {
                onRoadDelete(road.id);
              }
            }
          },
        }}
      >
        <Popup>
          <div className="text-sm">
            <p className="font-semibold">
              {locationMap.get(road.fromLocationId)?.name} →{" "}
              {locationMap.get(road.toLocationId)?.name}
            </p>
            <p>Distance: {road.distance} km</p>
            <p>Type: {road.isBidirectional ? "Bidirectional" : "One-way"}</p>
          </div>
        </Popup>
      </Polyline>
    );
  });

  // Draw route path using actual shortest road network geometry
  const activePolyline = roadPolyline.length > 1 ? roadPolyline : polyline.length > 1 ? polyline : null;
  const renderedRoadPolyline = activePolyline ? (
    <Polyline
      positions={activePolyline}
      color="#2563eb"
      weight={6}
      opacity={0.88}
      lineCap="round"
      lineJoin="round"
    />
  ) : routePath.length > 1 ? (
    <Polyline
      positions={routePath
        .map((id) => getLocationCoords(id))
        .filter((coord): coord is [number, number] => coord !== null)}
      color="#2563eb"
      weight={3}
      dashArray="6, 8"
      opacity={0.6}
    />
  ) : null;

  // Create numbered markers for route segments
  const routeNumberMarkers = routePath.length > 1 ? routePath.slice(0, -1).map((id, index) => {
    const fromCoords = getLocationCoords(id);
    const toCoords = getLocationCoords(routePath[index + 1]);
    
    if (!fromCoords || !toCoords) return null;
    
    // Calculate midpoint between two locations
    const midLat = (fromCoords[0] + toCoords[0]) / 2;
    const midLng = (fromCoords[1] + toCoords[1]) / 2;
    
    return (
      <Marker
        key={`route-number-${index}`}
        position={[midLat, midLng]}
        icon={createNumberedIcon(index + 1)}
      >
        <Popup>
          <div className="text-xs">
            <p className="font-semibold">Segment {index + 1}</p>
            <p className="text-gray-600">
              {locationMap.get(id)?.name} →{' '}
              {locationMap.get(routePath[index + 1])?.name}
            </p>
          </div>
        </Popup>
      </Marker>
    );
  }).filter(Boolean) : [];

  // Render location markers
  const locationMarkers = locations.map((location) => {
    let icon = defaultIcon;
    
    if (routePath.length > 0) {
      if (routePath[0] === location.id) icon = startIcon;
      else if (routePath[routePath.length - 1] === location.id) icon = endIcon;
      else if (routePathSet.has(location.id)) icon = waypointIcon;
    }

    const isSelected = selectedLocations.includes(location.id);

    return (
      <Marker
        key={location.id}
        position={[location.latitude, location.longitude]}
        icon={icon}
        eventHandlers={{
          click: () => handleLocationClick(location.id),
        }}
        opacity={isSelected ? 1 : editMode === "road" ? 0.7 : 1}
      >
        <Popup>
          <div className="text-sm">
            <p className="font-semibold text-lg">{location.name}</p>
            {location.description && <p className="text-gray-600">{location.description}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Lat: {location.latitude.toFixed(4)}, Lng: {location.longitude.toFixed(4)}
            </p>
            {editable && onLocationDelete && (
              <Button
                size="sm"
                variant="destructive"
                className="mt-2 w-full"
                onClick={() => {
                  if (confirm(`Delete location "${location.name}"?`)) {
                    onLocationDelete(location.id);
                  }
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </Popup>
      </Marker>
    );
  });

  let warehouseCount = 0;
  let deliveryCount = 0;
  const stopMarkers = stops.map((stop) => {
    const active = highlightedStopId === stop.id;
    const completed = stop.status === "DELIVERED" || stop.status === "COMPLETED";
    const isExplicitWarehouse =
      (stop.label && /^w\d*$/i.test(stop.label)) ||
      (stop.address && stop.address.toLowerCase().includes("warehouse")) ||
      (stop.id && String(stop.id).toLowerCase().includes("warehouse"));

    let resolvedLabel = stop.label;
    if (!resolvedLabel) {
      if (isExplicitWarehouse) {
        warehouseCount++;
        resolvedLabel = `W${warehouseCount}`;
      } else {
        deliveryCount++;
        resolvedLabel = String(deliveryCount);
      }
    }

    return (
      <Marker
        key={stop.id}
        position={[stop.lat, stop.lng]}
        icon={createRouteStopIcon(resolvedLabel, active, completed)}
        eventHandlers={{ click: () => onStopClick?.(stop.id) }}
      >
        <Popup>
          <div className="max-w-[220px] text-sm">
            <p className="font-semibold">{isExplicitWarehouse ? `Warehouse (${resolvedLabel})` : `Stop ${resolvedLabel}`}</p>
            {stop.address && <p className="text-gray-600">{stop.address}</p>}
            {stop.status && <p className="mt-1 text-xs text-gray-500">{stop.status.replaceAll("_", " ")}</p>}
          </div>
        </Popup>
      </Marker>
    );
  });

  return (
    <div className="relative h-full w-full">
      {editable && (
        <Card className="absolute top-4 right-4 z-[1000] p-4 bg-white shadow-lg">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm mb-3">Map Editor</h3>
            
            <Button
              size="sm"
              variant={editMode === "location" ? "default" : "outline"}
              className="w-full"
              onClick={() => {
                setEditMode(editMode === "location" ? null : "location");
                setIsAddingLocation(!isAddingLocation);
                setSelectedLocations([]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {editMode === "location" ? "Cancel Add Location" : "Add Location"}
            </Button>
            
            <Button
              size="sm"
              variant={editMode === "road" ? "default" : "outline"}
              className="w-full"
              onClick={() => {
                setEditMode(editMode === "road" ? null : "road");
                setIsAddingLocation(false);
                setSelectedLocations([]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {editMode === "road" ? "Cancel Add Road" : "Add Road"}
            </Button>
            
            {editMode === "location" && (
              <p className="text-xs text-gray-600">Click on the map to add a location</p>
            )}
            {editMode === "road" && (
              <p className="text-xs text-gray-600">
                Click two locations to create a road
                {selectedLocations.length > 0 && ` (${selectedLocations.length}/2 selected)`}
              </p>
            )}
          </div>
        </Card>
      )}

      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: "100%", borderRadius: "0.5rem", backgroundColor: "#f8fafc" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapClickHandler
          editable={editable}
          onLocationAdd={handleAddLocation}
          isAddingLocation={isAddingLocation}
        />
        
        <MapBoundsHandler locations={boundsLocations} />
        
        {roadLines}
        {renderedRoadPolyline}
        {routeNumberMarkers}
        {locationMarkers}
        {stopMarkers}
        {driverPosition && (
          <CircleMarker
            center={[driverPosition.lat, driverPosition.lng]}
            radius={9}
            pathOptions={{ color: "#ffffff", fillColor: "#2563eb", fillOpacity: 1, weight: 3 }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Driver position</p>
                <p className="text-gray-600">
                  {driverPosition.lat.toFixed(5)}, {driverPosition.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )}
        {driverPositions.map((driver) => (
          <CircleMarker
            key={driver.id}
            center={[driver.lat, driver.lng]}
            radius={10}
            pathOptions={{ color: "#ffffff", fillColor: "#f97316", fillOpacity: 1, weight: 3 }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{driver.name}</p>
                {driver.recordedAt && (
                  <p className="text-gray-600">
                    Updated {new Date(driver.recordedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
