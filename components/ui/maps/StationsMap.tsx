import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker, Region, Circle } from "react-native-maps";
import { useTheme } from "@/constants/theme";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Station } from "@/types";

interface StationsMapProps {
  userLocation: { lat: number; lng: number };
  centerLocation?: { lat: number; lng: number };
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (station: Station) => void;
  radiusKm?: number;
  showRadius?: boolean;
}

export default function StationsMap({
  userLocation,
  centerLocation,
  stations,
  selectedStation,
  onSelectStation,
  radiusKm = 5,
  showRadius = true,
}: StationsMapProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);

  // Use centerLocation (searched location) if provided, else fall back to userLocation
  const radiusCenter = centerLocation ?? userLocation;

  const initialRegion: Region = {
    latitude: radiusCenter.lat,
    longitude: radiusCenter.lng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    if (!mapRef.current || !showRadius) return;
    const radiusInMeters = radiusKm * 1000;
    const delta = (radiusInMeters / 111000) * 2.4;
    mapRef.current.fitToCoordinates(
      [
        { latitude: radiusCenter.lat + delta, longitude: radiusCenter.lng },
        { latitude: radiusCenter.lat - delta, longitude: radiusCenter.lng },
        { latitude: radiusCenter.lat, longitude: radiusCenter.lng + delta },
        { latitude: radiusCenter.lat, longitude: radiusCenter.lng - delta },
      ],
      { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }
    );
  }, [radiusCenter.lat, radiusCenter.lng, radiusKm, showRadius]);

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

  const s = styles(theme);

  return (
    <View style={{ flex: 1, overflow: "hidden", zIndex: 1 }}>
      <MapView
        ref={mapRef}
        provider="google"
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        customMapStyle={mapStyle(theme)}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        toolbarEnabled={false}
      >
        {/* USER RADIUS */}
        {showRadius && (
          <Circle
            center={{ latitude: radiusCenter.lat, longitude: radiusCenter.lng }}
            radius={radiusKm * 1000}
            strokeWidth={1.5}
            strokeColor={theme.primary + "60"}
            fillColor={theme.primary + "0C"}
          />
        )}

        {/* USER LOCATION PIN */}
        <Marker
          coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
          title="Your location"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={s.userPin}>
            <Ionicons name="home" size={14} color="#fff" />
          </View>
        </Marker>

        {/* STATION PINS */}
        {stations.map((station) => {
          const isSelected = selectedStation?._id === station._id;
          return (
            <Marker
              key={station._id}
              coordinate={{ latitude: station.location.lat, longitude: station.location.lng }}
              onPress={() => onSelectStation(station)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={s.pinWrapper}>
                <View style={[
                  s.pinBubble,
                  isSelected
                    ? { backgroundColor: theme.primary, borderColor: "#fff", borderWidth: 2 }
                    : { backgroundColor: "#fff", borderColor: theme.primary, borderWidth: 1.5 },
                ]}>
                  <MaterialIcons
                    name="local-gas-station"
                    size={isSelected ? 18 : 15}
                    color={isSelected ? "#fff" : theme.primary}
                  />
                </View>
                {/* Pin pointer */}
                <View style={[
                  s.pinTail,
                  { borderTopColor: isSelected ? theme.primary : "#fff" },
                ]} />
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    userPin: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: "#1A6B1A",
      justifyContent: "center", alignItems: "center",
      borderWidth: 2, borderColor: "#fff",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
    },
    pinWrapper: { alignItems: "center" },
    pinBubble: {
      width: 38, height: 38, borderRadius: 12,
      justifyContent: "center", alignItems: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18, shadowRadius: 6, elevation: 6,
    },
    pinTail: {
      width: 0, height: 0,
      borderLeftWidth: 5, borderRightWidth: 5,
      borderTopWidth: 7,
      borderLeftColor: "transparent", borderRightColor: "transparent",
      marginTop: -1,
    },
  });

const mapStyle = (theme: ReturnType<typeof useTheme>) => [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: theme.background }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: theme.text }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: theme.tertiary }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: theme.quinest }] },
  { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: theme.text }] },
];
