import React from "react";
import { StyleSheet, Text, View } from "react-native";
import VendorScreenShell from "@/components/ui/vendor/VendorScreenShell";
import { useTheme } from "@/constants/theme";

/**
 * Vendor Today (hero layout).
 *
 * Phase 0 placeholder — full hero card + alerts + queue preview lands
 * in Phase 2.
 */
export default function VendorTodayScreen() {
  const theme = useTheme();
  return (
    <VendorScreenShell title="Today">
      <View style={styles.body}>
        <Text style={{ color: theme.fgMuted, fontSize: 14 }}>
          Hero layout — Phase 2 build.
        </Text>
      </View>
    </VendorScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 8 },
});
