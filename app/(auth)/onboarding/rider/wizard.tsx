import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/constants/theme";
import { AuthScreenContainer } from "@/components/ui/auth";

/**
 * Placeholder — Phase 3 will replace this with the full 3-step wizard
 * (Affiliation / Profile / Vehicle). Kept so the auth Stack registers
 * the route and Phase 2's bootstrap router has somewhere to land.
 */
export default function RiderWizardStub() {
  const theme = useTheme();
  return (
    <AuthScreenContainer>
      <View style={styles.wrap}>
        <Text style={{ ...theme.type.h2, color: theme.fg, fontWeight: "800" }}>
          Rider wizard
        </Text>
        <Text style={{ color: theme.fgMuted, marginTop: 8 }}>
          The 3-step affiliation / profile / vehicle wizard lands in Phase 3.
        </Text>
      </View>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24 },
});
