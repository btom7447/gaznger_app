import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { useTheme } from "@/constants/theme";

export default function PointsBannerSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.skeleton }]}>
      <View style={styles.left}>
        <SkeletonBox width={44} height={44} borderRadius={22} style={{ marginRight: 12 }} />
        <View style={{ gap: 8 }}>
          <SkeletonBox width={70} height={26} borderRadius={8} />
          <SkeletonBox width={110} height={11} borderRadius={6} />
        </View>
      </View>
      <SkeletonBox width={78} height={30} borderRadius={20} style={{ marginRight: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
    height: 100,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
});
