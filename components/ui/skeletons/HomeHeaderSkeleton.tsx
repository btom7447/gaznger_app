import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";

export default function HomeHeaderSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <SkeletonBox width={72} height={11} borderRadius={6} style={{ marginBottom: 6 }} />
        <SkeletonBox width={150} height={26} borderRadius={8} />
      </View>
      <View style={styles.right}>
        <SkeletonBox width={40} height={40} borderRadius={12} style={{ marginRight: 10 }} />
        <SkeletonBox width={40} height={40} borderRadius={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  left: { gap: 4, flex: 1 },
  right: { flexDirection: "row", alignItems: "center" },
});
