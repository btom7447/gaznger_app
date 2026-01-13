import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useTheme } from "@/constants/theme";
import { MaterialIcons } from "@expo/vector-icons";

interface StationListItemProps {
  station: any;
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

  return (
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
        {/* Title Row */}
        <View style={styles(theme).titleRow}>
          <Text style={styles(theme).name}>{station.name}</Text>
          <MaterialIcons
            name={station.verified ? "verified" : "verified"}
            size={16}
            color={station.verified ? theme.quaternary : theme.ash}
            style={{ marginLeft: 6 }}
          />
        </View>

        {/* Address */}
        <View style={styles(theme).titleRow}>
          <MaterialIcons
            name={"place"}
            size={16}
            color={theme.text}
            style={{ marginRight: 6 }}
          />
          <Text style={styles(theme).address} numberOfLines={1}>
            {station.address}
          </Text>
        </View>

        {/* Distance */}
        {distance !== undefined && (
          <View style={styles(theme).titleRow}>
            <MaterialIcons
              name={"near-me"}
              size={16}
              color={theme.text}
              style={{ marginRight: 6 }}
            />
            <Text style={styles(theme).address} numberOfLines={1}>
              {distance.toFixed(2)} km{" "}
            </Text>
          </View>
        )}

        <View style={styles(theme).titleRow}>
          <MaterialIcons
            name={"star-rate"}
            size={16}
            color={theme.text}
            style={{ marginRight: 6 }}
          />
          <Text style={styles(theme).meta}>{station.rating?.toFixed(1) || "0.0"}</Text>
        </View>

        {/* {price !== undefined && (
            <Text style={styles(theme).price}>₦{price.toFixed(2)}</Text>
          )} */}
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
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "stretch",
      padding: 10,
      borderRadius: 15,
      backgroundColor: theme.background,
      marginVertical: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 3,
    },

    leftCol: {
      flex: 1,
      paddingRight: 10,
      flexDirection: "column", 
      justifyContent: "flex-start", 
      alignItems: "flex-start"
    },

    rightCol: {
      width: 140,
      alignSelf: "stretch",
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: theme.ash,
    },

    image: {
      width: "100%",
      height: "100%",
      borderRadius: 10,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      marginBottom: 10, 
    },

    name: {
      fontWeight: "600",
      fontSize: 16,
      color: theme.text,
    },

    address: {
      color: theme.text,
      fontSize: 13,
      opacity: 0.8,
      marginTop: 2,
    },

    infoRow: {
      flexDirection: "column",
      alignItems: "flex-start",
      marginTop: 6,
      gap: 12,
    },

    meta: {
      fontSize: 13,
      color: theme.text,
      opacity: 0.9,
    },

    price: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.quaternary,
    },
  });  