"use client";

import { useCallback, useEffect, useState } from "react";

export interface LivePosition {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export function useGeolocation() {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState("");

  const start = useCallback(() => {
    setError("");

    if (!("geolocation" in navigator)) {
      setError("Location tracking is not supported in this browser.");
      return;
    }

    setWatching(true);
  }, []);

  const stop = useCallback(() => {
    setWatching(false);
  }, []);

  useEffect(() => {
    if (!watching || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (location) => {
        setPosition({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        });
      },
      (geoError) => {
        setError(geoError.message || "Unable to read current location.");
        setWatching(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [watching]);

  return { position, watching, error, start, stop };
}
