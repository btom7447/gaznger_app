import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useState,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
} from "react-native";
import { Modalize } from "react-native-modalize";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { Station } from "@/types";
import { getStationLocalImage } from "@/utils/stationImage";

const FUEL_LOCAL_ICON: Record<string, ImageSourcePropType> = {
  petrol: require("../../../assets/icons/fuel/petrol-icon.png"),
  diesel: require("../../../assets/icons/fuel/diesel-icon.png"),
  gas:    require("../../../assets/icons/fuel/gas-icon.png"),
  oil:    require("../../../assets/icons/fuel/oil-icon.png"),
};

export interface StationDetailsModalHandle {
  open: () => void;
  close: () => void;
}

interface StationDetailsModalProps {
  station: Station;
  onClose: () => void;
  onConfirm?: () => void;
  confirming?: boolean;
}

const StationDetailsModal = forwardRef<StationDetailsModalHandle, StationDetailsModalProps>(
  ({ station, onClose, onConfirm, confirming = false }, ref) => {
    const theme = useTheme();
    const modalRef = useRef<Modalize>(null);
    const s = styles(theme);
    const [imgFailed, setImgFailed] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => modalRef.current?.open(),
      close: () => modalRef.current?.close(),
    }));

    if (!station) return null;

    const distance = station.distance;

    // ETA: base travel time (25 km/h avg delivery speed) + 8 min preparation
    const etaMinutes = distance !== undefined
      ? Math.max(10, Math.round((distance / 25) * 60) + 8)
      : null;

    const isOpen = station.isOpen !== false;

    const localFallback = getStationLocalImage(station.name);
    const imageSource = station.image && !imgFailed
      ? { uri: station.image }
      : localFallback;

    return (
      <Modalize
        ref={modalRef}
        adjustToContentHeight
        panGestureEnabled
        withHandle={false}
        modalStyle={{ backgroundColor: theme.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
        useNativeDriver
        onClosed={onClose}
      >
        <View style={s.container}>
          {/* Handle */}
          <View style={[s.handle, { backgroundColor: theme.ash }]} />

          {/* Station image banner */}
          <View style={s.imageBanner}>
            <Image
              source={imageSource}
              style={s.bannerImage}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
            <View style={s.bannerOverlay} />
            {/* Name + status over image */}
            <View style={s.bannerContent}>
              <View style={s.nameBadgeRow}>
                <Text style={s.bannerName} numberOfLines={1}>{station.name}</Text>
                {station.verified && (
                  <View style={s.verifiedBadge}>
                    <MaterialIcons name="verified" size={14} color="#22C55E" />
                  </View>
                )}
                {station.isPartner && (
                  <View style={s.partnerBadge}>
                    <Ionicons name="ribbon-outline" size={12} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={s.bannerAddress} numberOfLines={1}>{station.address}</Text>
            </View>
            {/* Open/Closed badge top-right */}
            <View style={[s.openBadge, { backgroundColor: isOpen ? "#22C55E" : "#EF4444" }]}>
              <Text style={s.openBadgeText}>{isOpen ? "Open" : "Closed"}</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={[s.statsRow, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={s.stat}>
              <Ionicons name="navigate-outline" size={18} color={theme.primary} />
              <Text style={[s.statValue, { color: theme.text }]}>
                {distance !== undefined ? `${distance.toFixed(1)} km` : "—"}
              </Text>
              <Text style={[s.statLabel, { color: theme.icon }]}>Distance</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: theme.ash }]} />
            <View style={s.stat}>
              <Ionicons name="time-outline" size={18} color={theme.primary} />
              <Text style={[s.statValue, { color: theme.text }]}>
                {etaMinutes !== null ? `~${etaMinutes} min` : "—"}
              </Text>
              <Text style={[s.statLabel, { color: theme.icon }]}>Est. Delivery</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: theme.ash }]} />
            <View style={s.stat}>
              <Ionicons name="star" size={18} color="#F59E0B" />
              <Text style={[s.statValue, { color: theme.text }]}>
                {station.rating?.toFixed(1) ?? "—"}
              </Text>
              <Text style={[s.statLabel, { color: theme.icon }]}>Rating</Text>
            </View>
          </View>

          {/* Available fuels with icons */}
          {station.fuels && station.fuels.length > 0 && (
            <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Available Fuels</Text>
              {station.fuels.map((f: any, i: number) => {
                const fuelName: string = f.fuel?.name ?? "Fuel";
                const available = f.available !== false;
                const localIcon = FUEL_LOCAL_ICON[fuelName.toLowerCase()] ?? FUEL_LOCAL_ICON.petrol;
                return (
                  <View
                    key={i}
                    style={[
                      s.fuelRow,
                      i < station.fuels.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.ash },
                    ]}
                  >
                    <View style={[s.fuelIconWrap, { backgroundColor: theme.tertiary }]}>
                      <Image
                        source={f.fuel?.icon ? { uri: f.fuel.icon } : localIcon}
                        style={s.fuelIcon}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={[s.fuelName, { color: available ? theme.text : theme.icon }]}>{fuelName}</Text>
                    <View style={[s.fuelAvailBadge, { backgroundColor: available ? "#22C55E18" : theme.ash + "40" }]}>
                      <Text style={[s.fuelAvailText, { color: available ? "#22C55E" : theme.icon }]}>
                        {available ? `₦${(f.pricePerUnit ?? 0).toLocaleString()}` : "Out"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: isOpen ? theme.primary : theme.ash }]}
            onPress={onConfirm}
            disabled={!isOpen || confirming}
            activeOpacity={0.85}
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={s.confirmText}>
                  {isOpen ? "Place Order" : "Station is Closed"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Modalize>
    );
  }
);

export default StationDetailsModal;

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 60,
      gap: 12,
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      alignSelf: "center", marginBottom: 8,
    },

    // Image banner
    imageBanner: {
      height: 150,
      borderRadius: 18,
      overflow: "hidden",
      marginBottom: 4,
    },
    bannerImage: {
      width: "100%",
      height: "100%",
    },
    bannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.52)",
    },
    bannerContent: {
      position: "absolute",
      bottom: 12,
      left: 14,
      right: 60,
    },
    bannerName: {
      fontSize: 18,
      fontWeight: "700",
      color: "#fff",
      marginBottom: 2,
    },
    bannerAddress: {
      fontSize: 12,
      color: "rgba(255,255,255,0.75)",
    },
    nameBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    verifiedBadge: {
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: 8,
      padding: 2,
    },
    partnerBadge: {
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: 8,
      padding: 2,
    },
    openBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    openBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },

    // Stats
    statsRow: {
      flexDirection: "row", borderRadius: 16, borderWidth: 1,
      paddingVertical: 14, paddingHorizontal: 8,
    },
    stat: { flex: 1, alignItems: "center", gap: 4 },
    statDivider: { width: 1, marginVertical: 4 },
    statValue: { fontSize: 15, fontWeight: "500" },
    statLabel: { fontSize: 11, fontWeight: "300" },

    // Section card
    section: {
      borderRadius: 16, borderWidth: 1,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
    },
    sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: 6 },

    // Order total
    totalRow: {
      flexDirection: "row", justifyContent: "space-between",
      paddingTop: 12, paddingBottom: 8, marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    totalLabel: { fontSize: 13, fontWeight: "400" },
    totalValue: { fontSize: 16, fontWeight: "600" },

    // Fuel list with icons
    fuelRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 10, gap: 10,
    },
    fuelIconWrap: {
      width: 30, height: 30, borderRadius: 8,
      alignItems: "center", justifyContent: "center",
    },
    fuelIcon: { width: 22, height: 22 },
    fuelName: { fontSize: 13, fontWeight: "400", flex: 1 },
    fuelAvailBadge: {
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 8,
    },
    fuelAvailText: { fontSize: 12, fontWeight: "500" },

    // CTA
    confirmBtn: {
      flexDirection: "row", gap: 10,
      paddingVertical: 16, borderRadius: 16,
      alignItems: "center", justifyContent: "center",
      marginTop: 4,
    },
    confirmText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  });
