import React from "react";
import { StyleSheet, Text, View } from "react-native";
import VendorScreenShell from "@/components/ui/vendor/VendorScreenShell";
import { useTheme } from "@/constants/theme";

export default function VendorFinanceScreen() {
  const theme = useTheme();
  return (
    <VendorScreenShell title="Finance">
      <View style={styles.body}>
        <Text style={{ color: theme.fgMuted, fontSize: 14 }}>
          Wallet + earnings + payouts + banks — Phase 6 build.
        </Text>
      </View>
    </VendorScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 8 },
});
