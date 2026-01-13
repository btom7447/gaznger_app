import React, { useEffect, useRef } from "react";
import { View, Image } from "react-native";
import MapView, { Marker, Region, Circle } from "react-native-maps";
import { useTheme } from "@/constants/theme";

interface StationsMapProps {
  userLocation: { lat: number; lng: number };
  stations: any[];
  selectedStation: any;
  onSelectStation: (station: any) => void;
  radiusKm?: number;
  showRadius?: boolean;
}

export default function StationsMap({
  userLocation,
  stations,
  selectedStation,
  onSelectStation,
  radiusKm = 5,
  showRadius = true,
}: StationsMapProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);

  /** Initial region (fallback) */
  const initialRegion: Region = {
    latitude: userLocation.lat,
    longitude: userLocation.lng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  /** Fit radius into ~70% of screen on first render */
  useEffect(() => {
    if (!mapRef.current || !userLocation || !showRadius) return;

    const lat = userLocation.lat;
    const lng = userLocation.lng;

    const radiusInMeters = radiusKm * 1000;
    const delta = (radiusInMeters / 111000) * 0.5; // 🔥 zoom in more

    mapRef.current.fitToCoordinates(
      [
        { latitude: lat + delta, longitude: lng },
        { latitude: lat - delta, longitude: lng },
        { latitude: lat, longitude: lng + delta },
        { latitude: lat, longitude: lng - delta },
      ],
      {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      }
    );
  }, [userLocation, radiusKm, showRadius]);

  /** Animate to selected station */
  useEffect(() => {
    if (selectedStation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedStation.location.lat,
          longitude: selectedStation.location.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600
      );
    }
  }, [selectedStation]);

  return (
    <View style={{ flex: 1, overflow: "hidden", zIndex: 1 }}>
      <MapView
        ref={mapRef}
        provider="google"
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        customMapStyle={getMapStyle(theme)}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        toolbarEnabled={false}
      >
        {/* USER RADIUS */}
        {showRadius && (
          <Circle
            center={{
              latitude: userLocation.lat,
              longitude: userLocation.lng,
            }}
            radius={radiusKm * 1000}
            strokeWidth={1}
            strokeColor={theme.quaternary}
            fillColor={`${theme.quinary}40`}
          />
        )}

        {/* USER LOCATION PIN */}
        <Marker
          coordinate={{
            latitude: userLocation.lat,
            longitude: userLocation.lng,
          }}
          title="Your location"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <Image
            source={require("@/assets/icons/map/pin-icon.png")}
            style={{ width: 40, height: 40 }}
            resizeMode="contain"
          />
        </Marker>

        {/* STATION PINS */}
        {stations.map((station) => {
          const isSelected = selectedStation?._id === station._id;

          return (
            <Marker
              key={station._id}
              coordinate={{
                latitude: station.location.lat,
                longitude: station.location.lng,
              }}
              onPress={() => onSelectStation(station)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <Image
                source={
                  require("@/assets/icons/map/station-icon.png")
                }
                style={{
                  width: isSelected ? 30 : 20,
                  height: isSelected ? 30 : 20,
                  transform: [{ scale: isSelected ? 1.05 : 1 }],
                }}
                resizeMode="contain"
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

/** Uber/Bolt style using your brand colors */
const getMapStyle = (theme: ReturnType<typeof useTheme>) => [
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: theme.background }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: theme.text }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: theme.tertiary }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: theme.quinest }],
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: theme.text }],
  },
];
