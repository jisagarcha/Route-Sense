"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
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

function RouteMapContent({
  locations,
  roads = [],
  routePath = [],
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

  // Get location coordinates by ID
  const getLocationCoords = (id: number): [number, number] | null => {
    const loc = locations.find((l) => l.id === id);
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
              if (confirm(`Delete road from ${locations.find(l => l.id === road.fromLocationId)?.name} to ${locations.find(l => l.id === road.toLocationId)?.name}?`)) {
                onRoadDelete(road.id);
              }
            }
          },
        }}
      >
        <Popup>
          <div className="text-sm">
            <p className="font-semibold">
              {locations.find((l) => l.id === road.fromLocationId)?.name} →{" "}
              {locations.find((l) => l.id === road.toLocationId)?.name}
            </p>
            <p>Distance: {road.distance} km</p>
            <p>Type: {road.isBidirectional ? "Bidirectional" : "One-way"}</p>
          </div>
        </Popup>
      </Polyline>
    );
  });

  // Draw route path with highlighted polyline
  const routePolyline = routePath.length > 1 ? (
    <Polyline
      positions={routePath
        .map((id) => getLocationCoords(id))
        .filter((coord): coord is [number, number] => coord !== null)}
      color="#2563eb"
      weight={4}
      opacity={0.7}
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
              {locations.find(l => l.id === id)?.name} →{' '}
              {locations.find(l => l.id === routePath[index + 1])?.name}
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
      else if (routePath.includes(location.id)) icon = waypointIcon;
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

  return (
    <div className="relative">
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
        style={{ height, width: "100%", borderRadius: "0.5rem" }}
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
        
        <MapBoundsHandler locations={locations} />
        
        {roadLines}
        {routePolyline}
        {routeNumberMarkers}
        {locationMarkers}
      </MapContainer>
    </div>
  );
}

// Export with dynamic import to avoid SSR issues
export const RouteMap = dynamic(() => Promise.resolve(RouteMapContent), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: "600px" }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});
