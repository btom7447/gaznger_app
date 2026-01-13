import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useOrderStore } from "@/store/useOrderStore";
import StationsMap from "@/components/ui/maps/StationsMap";
import StationsBottomSheet, {
  StationsBottomSheetRef,
} from "@/components/ui/maps/StationsBottomSheet";
import { useUserLocation } from "@/hooks/useUserLocation";

export default function StationsScreen() {
  const order = useOrderStore((s) => s.order);
  const setStation = useOrderStore((s) => s.setStation);
  const [searchRadius, setSearchRadius] = useState(3);

  const { location: userLocation, loading: locationLoading } =
    useUserLocation();

  const [stations, setStations] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState("closest");

  const bottomSheetRef = useRef<StationsBottomSheetRef>(null);

  /** Fetch stations within radius */
  const fetchStations = async () => {
    if (!userLocation) return;

    const tryFetch = async (radius: number) => {
      console.log("Fetching stations near:", userLocation, "radius:", radius);

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/stations?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radius}`
      );

      if (!res.ok) throw new Error("Failed to fetch stations");
      return res.json();
    };

    try {
      let data = await tryFetch(3);
      setSearchRadius(3);

      if (data.length === 0) {
        data = await tryFetch(5);
        setSearchRadius(5);
      }

      if (data.length === 0) {
        data = await tryFetch(10);
        setSearchRadius(10);
      }

      console.log("Stations fetched:", data);
      setStations(data);
    } catch (err) {
      console.error("Fetch stations error:", err);
    }
  };

  // Fetch stations whenever user location changes
  useEffect(() => {
    fetchStations();
  }, [userLocation]);

  /** Distance helper */
  const getDistanceKm = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /** Handle station selection */
  const handleSelectStation = (station: any) => {
    setSelectedStation(station);
    setStation({ id: station._id, label: station.name });
    requestAnimationFrame(() => bottomSheetRef.current?.open());
  };

  /** Filter + sort stations */
  const filteredStations = stations
    .map((s) => ({
      ...s,
      distance: userLocation
        ? getDistanceKm(
            userLocation.lat,
            userLocation.lng,
            s.location.lat,
            s.location.lng
          )
        : undefined,
      price: s.fuels.find((f: any) => f.fuel._id === order.fuel?._id)
        ?.pricePerUnit,
    }))
    .sort((a, b) => {
      if (sort === "closest") return (a.distance || 0) - (b.distance || 0);
      if (sort === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sort === "price") return (a.price || 0) - (b.price || 0);
      return 0;
    });

  if (locationLoading || !userLocation) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StationsMap
        userLocation={userLocation}
        stations={filteredStations}
        selectedStation={selectedStation}
        onSelectStation={handleSelectStation}
        radiusKm={searchRadius} // visualize the radius
        showRadius
      />

      {selectedStation && (
        <StationsBottomSheet
          ref={bottomSheetRef}
          stations={filteredStations}
          selectedStation={selectedStation}
          filters={filters}
          sort={sort}
          onChangeFilter={(key, value) =>
            setFilters({ ...filters, [key]: value })
          }
          onSortChange={setSort}
          onSelectStation={handleSelectStation}
        />
      )}
    </View>
  );
}