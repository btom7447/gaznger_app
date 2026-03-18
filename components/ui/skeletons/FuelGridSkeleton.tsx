import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { useTheme } from "@/constants/theme";

export default function FuelGridSkeleton({ count = 4 }: { count?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <SkeletonBox width={68} height={68} borderRadius={34} style={{ marginBottom: 12 }} />
          <SkeletonBox width={70} height={14} borderRadius={7} style={{ marginBottom: 6 }} />
          <SkeletonBox width={50} height={11} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "center",
    paddingVertical: 8,
  },
  card: {
    width: "46%",
    height: 140,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
});
