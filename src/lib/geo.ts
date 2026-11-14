/**
 * Centralized Geographic & Spatial Utilities
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export const DEFAULT_DEPOT: LatLngPoint = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT) || 27.7172,
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG) || 85.324,
};

/**
 * Calculate distance in kilometers between two lat/lng points using Haversine formula
 */
export function haversineDistanceKm(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLng2 = Math.sin(dLng / 2);

  const val = sinDLat2 * sinDLat2 + Math.cos(lat1) * Math.cos(lat2) * sinDLng2 * sinDLng2;
  const c = 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
  return R * c;
}

/**
 * Overload helper accepting raw coordinate numbers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistanceKm({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 });
}
