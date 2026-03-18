import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { useTheme } from "@/constants/theme";

function NotificationItemSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.ash }]}>
      <SkeletonBox width={8} height={8} borderRadius={4} style={{ marginRight: 14, marginTop: 4 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox width={160} height={15} borderRadius={6} />
        <SkeletonBox width="90%" height={12} borderRadius={6} />
        <SkeletonBox width="75%" height={12} borderRadius={6} />
        <SkeletonBox width={80} height={11} borderRadius={6} />
      </View>
    </View>
  );
}

export default function NotificationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <NotificationItemSkeleton key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
});
