import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { toast } from "sonner-native";
import { Ionicons } from "@expo/vector-icons";
import { useOrderStore } from "@/store/useOrderStore";
import StationsMap from "@/components/ui/maps/StationsMap";
import StationsBottomSheet, {
  StationsBottomSheetRef,
} from "@/components/ui/maps/StationsBottomSheet";
import { useUserLocation } from "@/hooks/useUserLocation";
import StationDetailsModal from "@/components/ui/maps/StationDetailsModal";
import { api } from "@/lib/api";
import { Station } from "@/types";
import { useTheme } from "@/constants/theme";
import MapSkeleton from "@/components/ui/skeletons/MapSkeleton";
import OrderProgressBar from "@/components/ui/global/OrderProgressBar";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// searchRow: paddingTop(8) + input(40) + paddingBottom(6) = 54, plus marginBottom(10) = 64
const SEARCH_ROW_HEIGHT = 64;

interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

export default function StationsScreen() {
  const theme = useTheme();
  const order = useOrderStore((s) => s.order);
  const setStation = useOrderStore((s) => s.setStation);
  const deliveryCoords = useOrderStore((s) => s.order.deliveryCoords);

  const [searchRadius, setSearchRadius] = useState(3);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState("closest");
  const [confirming, setConfirming] = useState(false);
  const [loadingStations, setLoadingStations] = useState(true);

  // Location search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>([]);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noStationsFound, setNoStationsFound] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomSheetRef = useRef<StationsBottomSheetRef>(null);
  const detailsModalRef = useRef<React.ComponentRef<typeof StationDetailsModal>>(null);

  const { location: userLocation, loading: locationLoading } = useUserLocation();
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Priority: manual map search > delivery address coords > GPS location
  const effectiveLocation = searchLocation ?? deliveryCoords ?? userLocation;

  // isSearch=true: fixed 10km radius, no auto-expand — triggers empty state if nothing found
  // isSearch=false (user location): auto-expand 3→5→10km to always find nearest stations
  // forcedRadius: bypasses auto-expand, uses the given radius exactly (for manual radius chip)
  const fetchStations = async (
    loc?: { lat: number; lng: number },
    isSearch = false,
    forcedRadius?: number
  ) => {
    const target = loc ?? effectiveLocation;
    if (!target) return;
    setLoadingStations(true);
    setNoStationsFound(false);
    const tryFetch = async (radius: number) => {
      const res = await api.get<{ data: any[]; total: number }>(
        `/api/stations?lat=${target.lat}&lng=${target.lng}&radius=${radius}`
      );
      return res.data ?? [];
    };

    let hasResults = false;
    try {
      let data: any[];
      if (forcedRadius !== undefined) {
        data = await tryFetch(forcedRadius);
        setSearchRadius(forcedRadius);
      } else if (isSearch) {
        data = await tryFetch(10);
        setSearchRadius(10);
      } else {
        data = await tryFetch(3);
        setSearchRadius(3);
        if (!data.length) { data = await tryFetch(5); setSearchRadius(5); }
        if (!data.length) { data = await tryFetch(10); setSearchRadius(10); }
      }
      setStations(data);

      if (data.length > 0) {
        hasResults = true;
        const best = [...data].sort((a, b) => {
          if (a.verified !== b.verified) return a.verified ? -1 : 1;
          return (b.rating ?? 0) - (a.rating ?? 0);
        })[0];
        setSelectedStation(best);
        setStation({ id: best._id, label: best.name });
        // Bottom sheet only opens when user taps a pin — not auto-opened here
      }
    } catch {
      // stations remain empty — map shows no markers
    } finally {
      if (!hasResults) setNoStationsFound(true);
      setLoadingStations(false);
    }
  };

  useEffect(() => {
    if (!userLocation || searchLocation) return;
    // Use delivery address coords as center if available, otherwise user's GPS
    const center = deliveryCoords ?? userLocation;
    fetchStations(center, false);
  }, [userLocation]);

  // Geocoding search via Nominatim
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "en", "User-Agent": "GazngerApp/1.0" },
        });
        const data: LocationSuggestion[] = await res.json();
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    const label = suggestion.display_name.split(",").slice(0, 2).join(",").trim();
    setSearchQuery(label);
    setSearchLocation({ lat, lng });
    setShowDropdown(false);
    setSearchResults([]);
    Keyboard.dismiss();
    setSelectedStation(null);
    setStations([]);
    bottomSheetRef.current?.close();
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    fetchStations({ lat, lng }, true);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchLocation(null);
    setSearchResults([]);
    setShowDropdown(false);
    setNoStationsFound(false);
    if (userLocation) {
      setSelectedStation(null);
      setStations([]);
      fetchStations(userLocation, false);
    }
  };

  const getDistanceKm = (
    lat1: number, lng1: number, lat2: number, lng2: number
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const refLoc = effectiveLocation;

  const filteredStations = stations
    .map((s) => ({
      ...s,
      distance: refLoc
        ? getDistanceKm(refLoc.lat, refLoc.lng, s.location.lat, s.location.lng)
        : undefined,
      price: s.fuels.find((f: any) => f.fuel._id === order.fuel?._id)?.pricePerUnit,
    }))
    .sort((a, b) => {
      if (sort === "closest") return (a.distance || 0) - (b.distance || 0);
      if (sort === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sort === "price") return (a.price || 0) - (b.price || 0);
      return 0;
    });

  const handleSelectStation = (station: any) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const alreadySelected = selectedStation?._id === station._id;
    if (alreadySelected) {
      const wasOpen = bottomSheetRef.current?.isOpen() ?? false;
      bottomSheetRef.current?.toggle();
      Animated.timing(overlayOpacity, {
        toValue: wasOpen ? 0 : 0.35,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      setSelectedStation(station);
      setStation({ id: station._id, label: station.name });
      bottomSheetRef.current?.open();
      Animated.timing(overlayOpacity, { toValue: 0.35, duration: 250, useNativeDriver: true }).start();
    }
  };

  const handleGazngerPick = () => {
    if (!filteredStations.length) return;
    const best = [...filteredStations].sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return (b.rating ?? 0) - (a.rating ?? 0);
    })[0];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedStation(best);
    setStation({ id: best._id, label: best.name });
    Animated.timing(overlayOpacity, { toValue: 0.35, duration: 250, useNativeDriver: true }).start();
  };

  const handleStationPress = (station: any) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedStation(station);
    setShowDetails(true);
    bottomSheetRef.current?.close();
    Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    setTimeout(() => detailsModalRef.current?.open(), 50);
  };

  const handleCloseSheet = () => {
    Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const handleBack = () => {
    useOrderStore.getState().setProgressStep(0);
    router.back();
  };

  const handleConfirmStation = async () => {
    if (!selectedStation || !order.fuel || confirming) return;
    setConfirming(true);
    try {
      const orderPayload = {
        fuelId: order.fuel._id,
        quantity: order.quantity,
        cylinderType: order.cylinderType,
        deliveryType: order.deliveryType,
        deliveryAddressId: order.deliveryAddressId,
        stationId: selectedStation._id,
        cylinderImages: order.cylinderImages,
      };
      const createdOrder = await api.post<{ _id: string; totalPrice: number }>(
        "/api/orders",
        orderPayload
      );

      detailsModalRef.current?.close();
      useOrderStore.getState().setProgressStep(2);

      router.push({
        pathname: "/(customer)/(order)/payment" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        params: {
          orderId: createdOrder._id,
          totalPrice: String(createdOrder.totalPrice),
          fuelName: order.fuel?.name ?? "",
          quantity: String(order.quantity),
          unit: order.fuel?.unit ?? "",
          stationName: selectedStation.name ?? "",
          deliveryLocation: order.deliveryLabel ?? "",
          cylinderType: order.cylinderType ?? "",
          deliveryType: order.deliveryType ?? "",
        },
      });
    } catch (err: any) {
      toast.error("Failed to place order", { description: err.message });
    } finally {
      setConfirming(false);
    }
  };

  if (locationLoading || !userLocation)
    return <MapSkeleton />;

  return (
    <View style={{ flex: 1 }}>
      <StationsMap
        userLocation={userLocation}
        centerLocation={effectiveLocation ?? userLocation}
        stations={filteredStations}
        selectedStation={selectedStation}
        onSelectStation={handleSelectStation}
        radiusKm={searchRadius}
        showRadius
      />

      <Animated.View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "black",
          opacity: overlayOpacity,
        }}
      />

      {/* Top overlay: back + search (no bg) then progress bar (bg) */}
      <SafeAreaView
        edges={["top"]}
        style={styles.topOverlay}
        pointerEvents="box-none"
      >
        {/* Back button + Search input — transparent, sits above dropdown */}
        <View style={styles.searchRow} pointerEvents="box-none">
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.ash }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <Ionicons name="search-outline" size={15} color={theme.icon} style={{ marginRight: 7 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search a location…"
              placeholderTextColor={theme.icon}
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
            />
            {searchLoading && (
              <ActivityIndicator size="small" color={theme.icon} style={{ marginLeft: 4 }} />
            )}
            {searchQuery.length > 0 && !searchLoading && (
              <TouchableOpacity
                onPress={handleClearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={theme.icon} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Progress bar — has background, sits in normal flow below search row */}
        <View pointerEvents="none" style={{ backgroundColor: theme.background + "F2", marginHorizontal: 10, borderRadius: 20, }}>
          <OrderProgressBar />
        </View>

        {/* Dropdown — absolutely positioned from top:0, slides under search row via zIndex, paddingTop pushes items below it */}
        {showDropdown && searchResults.length > 0 && (
          <View
            style={[
              styles.dropdown,
              { backgroundColor: theme.surface, borderColor: theme.ash },
            ]}
          >
            <View style={styles.dropdownPadding} />
            {searchResults.map((item, idx) => (
              <TouchableOpacity
                key={item.place_id}
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: theme.ash },
                  idx === searchResults.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={theme.quaternary}
                  style={{ marginRight: 8, flexShrink: 0 }}
                />
                <Text
                  style={[styles.dropdownText, { color: theme.text }]}
                  numberOfLines={2}
                >
                  {item.display_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeAreaView>

      {/* Gaznger Pick badge — shown while loading stations */}
      {loadingStations && (
        <View style={[styles.gazngerPickBadge, { backgroundColor: theme.quaternary }]}>
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.gazngerPickText}>Gaznger is picking the best station…</Text>
        </View>
      )}

      {/* No stations in searched location */}
      {noStationsFound && !loadingStations && (
        <View style={[styles.noStationsBadge, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Ionicons name="location-outline" size={20} color={theme.quaternary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noStationsTitle, { color: theme.text }]}>
              No stations in this area
            </Text>
            <Text style={[styles.noStationsSub, { color: theme.icon }]}>
              We're expanding — Gaznger is coming here soon!
            </Text>
          </View>
        </View>
      )}

      <StationsBottomSheet
        ref={bottomSheetRef}
        stations={filteredStations}
        selectedStation={selectedStation}
        loading={loadingStations}
        filters={filters}
        sort={sort}
        radius={searchRadius}
        onChangeFilter={(key, value) => setFilters({ ...filters, [key]: value })}
        onSortChange={setSort}
        onRadiusChange={(km) => {
          const target = effectiveLocation ?? userLocation;
          if (!target) return;
          setStations([]);
          fetchStations(target, !!searchLocation, km);
        }}
        onSelectStation={handleStationPress}
        onClose={handleCloseSheet}
        onGazngerPick={handleGazngerPick}
      />

      {showDetails && selectedStation && (
        <StationDetailsModal
          ref={detailsModalRef}
          station={selectedStation}
          onClose={() => setShowDetails(false)}
          onConfirm={handleConfirmStation}
        />
      )}

      {confirming && (
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)" }}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10,
    marginBottom: 10,
    zIndex: 20,
    // no backgroundColor — transparent over the map
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  dropdown: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
    paddingTop: SEARCH_ROW_HEIGHT,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 10,
  },
  dropdownPadding: {
    marginBottom: 35,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  gazngerPickBadge: {
    position: "absolute",
    top: 170,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  gazngerPickText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  noStationsBadge: {
    position: "absolute",
    top: 170,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  noStationsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  noStationsSub: {
    fontSize: 12,
    fontWeight: "400",
  },
});
