import React from "react";
import { StyleSheet, Text, View } from "react-native";
import VendorScreenShell from "@/components/ui/vendor/VendorScreenShell";
import { useTheme } from "@/constants/theme";

export default function VendorOrdersScreen() {
  const theme = useTheme();
  return (
    <VendorScreenShell title="Orders">
      <View style={styles.body}>
        <Text style={{ color: theme.fgMuted, fontSize: 14 }}>
          Queue + assign rider — Phase 3 build.
        </Text>
      </View>
    </VendorScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 8 },
});
