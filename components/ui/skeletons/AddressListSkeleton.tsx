import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { useTheme } from "@/constants/theme";

function AddressItemSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.ash, backgroundColor: theme.surface }]}>
      {/* Icon square — matches 44×44 borderRadius 12 card icon wrap */}
      <SkeletonBox width={44} height={44} borderRadius={12} />

      {/* Content — label + street/city line */}
      <View style={{ flex: 1, marginLeft: 12, gap: 7 }}>
        <SkeletonBox width={100} height={13} borderRadius={6} />
        <SkeletonBox width={160} height={11} borderRadius={5} />
      </View>

      {/* Action buttons — pencil + trash */}
      <View style={{ flexDirection: "row", gap: 4, marginLeft: 4 }}>
        <SkeletonBox width={32} height={32} borderRadius={8} />
        <SkeletonBox width={32} height={32} borderRadius={8} />
      </View>
    </View>
  );
}

export default function AddressListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <AddressItemSkeleton key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 12,
    padding: 14,
  },
});
