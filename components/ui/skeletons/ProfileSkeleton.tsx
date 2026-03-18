import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";

export default function ProfileSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.avatarSection}>
        <SkeletonBox width={88} height={88} borderRadius={44} />
        <SkeletonBox width={130} height={16} borderRadius={8} style={{ marginTop: 14 }} />
        <SkeletonBox width={90} height={12} borderRadius={6} style={{ marginTop: 7 }} />
      </View>

      <View style={styles.section}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={styles.row}>
            <SkeletonBox width={20} height={20} borderRadius={10} />
            <View style={{ flex: 1, gap: 6, marginLeft: 14 }}>
              <SkeletonBox width={80} height={11} borderRadius={6} />
              <SkeletonBox width={160} height={14} borderRadius={6} />
            </View>
          </View>
        ))}
      </View>

      <SkeletonBox height={52} borderRadius={16} style={{ marginHorizontal: 20, marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  section: { paddingHorizontal: 20, gap: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
});
