import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
} from "react-native";
import { useTheme } from "@/constants/theme";
import { MaterialIcons } from "@expo/vector-icons";
import { Station } from "@/types";

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
  const scaleAnim = useRef(new Animated.Value(selected ? 1.05 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(selected ? 1 : 0.9)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: selected ? 1.05 : 1,
      useNativeDriver: true,
      stiffness: 120,
      damping: 12,
    }).start();

    Animated.timing(opacityAnim, {
      toValue: selected ? 1 : 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }}
    >
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles(theme).container,
          selected && {
            borderColor: theme.quaternary,
            borderWidth: 1,
            backgroundColor: theme.quinest,
          },
        ]}
        activeOpacity={0.8}
      >
        {/* LEFT COLUMN */}
        <View style={styles(theme).leftCol}>
          <View style={styles(theme).titleRow}>
            <Text style={styles(theme).name}>{station.name}</Text>
            <MaterialIcons
              name="verified"
              size={16}
              color={station.verified ? theme.quaternary : theme.ash}
              style={{ marginLeft: 6 }}
            />
          </View>

          <View style={styles(theme).titleRow}>
            <MaterialIcons
              name="place"
              size={16}
              color={theme.text}
              style={{ marginRight: 6 }}
            />
            <Text style={styles(theme).address} numberOfLines={1}>
              {station.address}
            </Text>
          </View>

          {distance !== undefined && (
            <View style={styles(theme).titleRow}>
              <MaterialIcons
                name="near-me"
                size={16}
                color={theme.text}
                style={{ marginRight: 6 }}
              />
              <Text style={styles(theme).address}>
                {distance.toFixed(2)} km
              </Text>
            </View>
          )}

          <View style={styles(theme).titleRow}>
            <MaterialIcons
              name="star-rate"
              size={16}
              color={theme.text}
              style={{ marginRight: 6 }}
            />
            <Text style={styles(theme).meta}>
              {station.rating?.toFixed(1) || "0.0"}
            </Text>
          </View>
        </View>

        {/* RIGHT COLUMN (IMAGE) */}
        <View style={styles(theme).rightCol}>
          <Image
            source={{ uri: station.image }}
            style={styles(theme).image}
            resizeMode="cover"
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 16,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.ash,
      marginVertical: 5,
      height: 110,
    },
    leftCol: {
      flex: 1,
      paddingRight: 10,
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "flex-start",
    },
    rightCol: {
      width: 130,
      height: 88,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.skeleton,
    },
    image: { width: "100%", height: "100%", borderRadius: 12 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      marginBottom: 8,
    },
    name: { fontWeight: "500", fontSize: 15, color: theme.text },
    address: { color: theme.icon, fontSize: 12, fontWeight: "300", marginTop: 1 },
    meta: { fontSize: 12, fontWeight: "300", color: theme.icon },
  });