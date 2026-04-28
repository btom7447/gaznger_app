import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { Station } from "@/types";
import { getStationLocalImage } from "@/utils/stationImage";

interface StationListItemProps {
  station: Station;
  selected?: boolean;
  onPress: () => void;
  price?: number;
  distance?: number;
}

export default function StationListItem({
  station,
  selected = false,
  onPress,
  price,
  distance,
}: StationListItemProps) {
  const theme = useTheme();
  const s = styles(theme);
  const [imgFailed, setImgFailed] = useState(false);

  const localFallback = getStationLocalImage(station.name);
  const imageSource = station.image && !imgFailed
    ? { uri: station.image }
    : localFallback;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.card,
        selected && {
          borderColor: theme.primary,
          backgroundColor: theme.tertiary + "40",
        },
      ]}
    >
      {/* Station image */}
      <View style={{ flexShrink: 0 }}>
        <View style={s.imageWrap}>
          <Image
            source={imageSource}
            style={s.image}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        </View>
        {station.isPartner && (
          <View
            style={[s.dot, s.leftDot, { backgroundColor: theme.background }]}
          >
            <Ionicons name="ribbon-outline" size={12} color={theme.primary} />
          </View>
        )}

        {station.verified && (
          <View
            style={[s.dot, s.rightDot, { backgroundColor: theme.background }]}
          >
            <MaterialIcons name="verified" size={12} color="#22C55E" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={s.content}>
        <View style={s.titleRow}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>
            {station.name}
          </Text>

          {station.isOpen !== false && (
            <View style={[s.openBadge, { backgroundColor: "#22C55E18" }]}>
              <Text style={[s.openText, { color: "#22C55E" }]}>Open</Text>
            </View>
          )}
        </View>

        <Text style={[s.address, { color: theme.icon }]} numberOfLines={1}>
          {station.address}
        </Text>

        <View style={s.metaRow}>
          {distance !== undefined && (
            <View style={s.metaChip}>
              <Ionicons name="navigate-outline" size={11} color={theme.icon} />
              <Text style={[s.metaText, { color: theme.icon }]}>
                {distance.toFixed(1)} km
              </Text>
            </View>
          )}
          {price !== undefined && price > 0 && (
            <View style={s.metaChip}>
              <Ionicons name="pricetag-outline" size={11} color={theme.icon} />
              <Text style={[s.metaText, { color: theme.icon }]}>
                ₦{price.toLocaleString()}/unit
              </Text>
            </View>
          )}
          {station.rating !== undefined && station.rating > 0 && (
            <View style={s.metaChip}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={
                    star <= Math.round(station.rating) ? "star" : "star-outline"
                  }
                  size={10}
                  color="#F59E0B"
                />
              ))}
              <Text style={[s.metaText, { color: theme.icon, marginLeft: 2 }]}>
                {station.rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Select indicator */}
      <View
        style={[s.selector, selected && { backgroundColor: theme.primary }]}
      >
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.ash,
      backgroundColor: theme.background,
      marginVertical: 4,
    },
    imageWrap: {
      width: 52,
      height: 52,
      borderRadius: 14,
      overflow: "hidden",
    },
    image: {
      width: "100%",
      height: "100%",
    },
    verifiedDot: {
      position: "absolute",
      bottom: -3,
      right: -3,
      borderRadius: 8,
      padding: 1,
      borderWidth: 1.5,
      borderColor: theme.background,
    },
    dot: {
      position: "absolute",
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: theme.background,
    },

    leftDot: {
      left: -4,
      bottom: -4,
    },

    rightDot: {
      right: -4,
      bottom: -4,
    },
    content: { flex: 1, gap: 3 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: { fontSize: 14, fontWeight: "500", flex: 1 },
    openBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    openText: { fontSize: 10, fontWeight: "600" },
    address: { fontSize: 12, fontWeight: "300" },
    metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 2 },
    metaText: { fontSize: 11, fontWeight: "300" },
    partnerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    partnerText: { fontSize: 10, fontWeight: "600" },
    selector: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.ash,
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
  });
