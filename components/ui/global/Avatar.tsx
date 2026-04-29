/**
 * Avatar — shared profile picture component.
 *
 * - Shows image from `uri` when provided and successfully loaded.
 * - Falls back to `initials` (up to 2 chars) on error or missing URI.
 * - Falls back to a generic icon when neither is available.
 * - `size` controls width/height; `radius` controls border-radius (defaults to size/4).
 */
import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

interface AvatarProps {
  uri?: string | null;
  initials?: string;
  size?: number;
  radius?: number;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function Avatar({
  uri,
  initials,
  size = 44,
  radius,
  icon = "person-outline",
}: AvatarProps) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  // Reset failed state when URI changes so new images always attempt to load
  useEffect(() => { setFailed(false); }, [uri]);

  const r = radius ?? Math.round(size / 4);
  const showImage = !!uri && !failed;
  const showInitials = !showImage && !!initials;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: theme.tertiary,
        },
      ]}
    >
      {showImage && (
        <Image
          key={uri}
          source={{ uri, cache: "reload" }}
          style={[styles.img, { borderRadius: r }]}
          onError={() => setFailed(true)}
          resizeMode="cover"
        />
      )}
      {!showImage && showInitials && (
        <Text style={[styles.initials, { color: theme.primary, fontSize: Math.round(size * 0.35) }]}>
          {initials!.toUpperCase().slice(0, 2)}
        </Text>
      )}
      {!showImage && !showInitials && (
        <Ionicons name={icon} size={Math.round(size * 0.55)} color={theme.icon} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  img: { width: "100%", height: "100%" },
  initials: { fontWeight: "700" },
});
