import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { useTheme } from "@/constants/theme";

export default function StationsMapSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Map placeholder */}
      <SkeletonBox height={420} borderRadius={0} style={{ width: "100%" }} />

      {/* Bottom sheet stub */}
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={[styles.handle, { backgroundColor: theme.skeleton }]} />

        {/* Filter bar stub */}
        <View style={styles.filterRow}>
          {[90, 75, 65].map((w, i) => (
            <SkeletonBox key={i} width={w} height={34} borderRadius={17} style={{ marginRight: 10 }} />
          ))}
        </View>

        {/* Station list stubs */}
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={{ flex: 1, paddingRight: 10, gap: 10 }}>
              <SkeletonBox width={130} height={15} borderRadius={6} />
              <SkeletonBox width={100} height={12} borderRadius={6} />
              <SkeletonBox width={70} height={12} borderRadius={6} />
              <SkeletonBox width={50} height={12} borderRadius={6} />
            </View>
            <SkeletonBox width={130} height={88} borderRadius={12} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 400,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    marginVertical: 5,
    height: 110,
    borderWidth: 1,
  },
});
