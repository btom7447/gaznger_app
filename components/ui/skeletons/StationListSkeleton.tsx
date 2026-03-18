import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { useTheme } from "@/constants/theme";

function StationListItemSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
      <View style={styles.left}>
        <SkeletonBox width={130} height={15} borderRadius={6} style={{ marginBottom: 10 }} />
        <SkeletonBox width={100} height={12} borderRadius={6} style={{ marginBottom: 10 }} />
        <SkeletonBox width={70} height={12} borderRadius={6} style={{ marginBottom: 10 }} />
        <SkeletonBox width={50} height={12} borderRadius={6} />
      </View>
      <SkeletonBox width={130} height={88} borderRadius={12} />
    </View>
  );
}

export default function StationListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <StationListItemSkeleton key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 5,
    height: 110,
  },
  left: {
    flex: 1,
    paddingRight: 10,
  },
});
