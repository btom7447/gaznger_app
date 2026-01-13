import { useEffect, useState } from "react";
import * as Location from "expo-location";

export interface UserLocation {
  lat: number;
  lng: number;
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      } catch (err) {
        console.error("Location error:", err);
      } finally {
        setLoading(false);
      }
    };

    getLocation();
  }, []);

  return { location, loading, permissionDenied };
}