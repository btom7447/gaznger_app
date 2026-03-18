import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { useTheme } from "@/constants/theme";
import SkeletonBox from "./SkeletonBox";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Full-screen map placeholder skeleton.
 * Mimics a map canvas with road-line shapes and marker pins.
 */
export default function MapSkeleton() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.quinest }]}>
      {/* Horizontal road lines */}
      <SkeletonBox width="100%" height={6} borderRadius={3} style={{ position: "absolute", top: "30%", opacity: 0.7 }} />
      <SkeletonBox width="100%" height={4} borderRadius={2} style={{ position: "absolute", top: "52%", opacity: 0.5 }} />
      <SkeletonBox width="100%" height={5} borderRadius={2} style={{ position: "absolute", top: "70%", opacity: 0.6 }} />

      {/* Vertical road lines */}
      <SkeletonBox width={5} height={300} borderRadius={2} style={{ position: "absolute", left: "25%", opacity: 0.5 }} />
      <SkeletonBox width={4} height={300} borderRadius={2} style={{ position: "absolute", left: "65%", opacity: 0.4 }} />

      {/* Diagonal road block */}
      <SkeletonBox width={180} height={5} borderRadius={2} style={{ position: "absolute", top: "42%", left: "20%", transform: [{ rotate: "-25deg" }], opacity: 0.45 }} />

      {/* Block shapes (buildings/areas) */}
      <SkeletonBox width={80} height={50} borderRadius={8} style={{ position: "absolute", top: "15%", left: "10%", opacity: 0.5 }} />
      <SkeletonBox width={60} height={40} borderRadius={8} style={{ position: "absolute", top: "18%", left: "55%", opacity: 0.45 }} />
      <SkeletonBox width={90} height={45} borderRadius={8} style={{ position: "absolute", top: "60%", left: "60%", opacity: 0.4 }} />
      <SkeletonBox width={70} height={35} borderRadius={8} style={{ position: "absolute", top: "75%", left: "5%", opacity: 0.45 }} />

      {/* Center user pin */}
      <View style={styles.centerPin}>
        <SkeletonBox width={36} height={36} borderRadius={18} />
        <SkeletonBox width={2} height={16} borderRadius={1} style={{ marginTop: 2 }} />
      </View>

      {/* Scattered station pin placeholders */}
      <View style={[styles.pin, { top: "28%", left: "20%" }]}>
        <SkeletonBox width={32} height={32} borderRadius={10} />
        <SkeletonBox width={2} height={10} borderRadius={1} style={{ marginTop: 2 }} />
      </View>
      <View style={[styles.pin, { top: "45%", left: "60%" }]}>
        <SkeletonBox width={32} height={32} borderRadius={10} />
        <SkeletonBox width={2} height={10} borderRadius={1} style={{ marginTop: 2 }} />
      </View>
      <View style={[styles.pin, { top: "65%", left: "35%" }]}>
        <SkeletonBox width={28} height={28} borderRadius={9} />
        <SkeletonBox width={2} height={10} borderRadius={1} style={{ marginTop: 2 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    overflow: "hidden",
  },
  centerPin: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -18 }, { translateY: -52 }],
    alignItems: "center",
  },
  pin: {
    position: "absolute",
    alignItems: "center",
  },
});
