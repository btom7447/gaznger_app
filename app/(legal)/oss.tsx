import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import {
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Open-source licenses screen (audit B.3).
 *
 * Apple App Store review checks for an in-app OSS notices screen for
 * dependencies that require attribution (BSD, MIT, Apache 2.0). We
 * keep this list manually maintained for the production-critical
 * deps; auto-generation from package.json would balloon to ~600
 * entries (transitive trees) with no review value.
 *
 * Add new libraries here when they ship to production. Format mirrors
 * how Apple's own apps list licenses — name, version label, license,
 * one-line attribution.
 */

interface LibEntry {
  name: string;
  license: string;
  /** Short attribution / copyright line. */
  notice: string;
}

// Top-level dependencies the customer app ships in production. Trim
// to the libraries that materially shape the runtime bundle.
const LIBS: LibEntry[] = [
  { name: "React Native", license: "MIT", notice: "Copyright © Meta Platforms, Inc. and affiliates." },
  { name: "React", license: "MIT", notice: "Copyright © Meta Platforms, Inc. and affiliates." },
  { name: "Expo SDK", license: "MIT", notice: "Copyright © 650 Industries, Inc. (Expo)." },
  { name: "Expo Router", license: "MIT", notice: "Copyright © 650 Industries, Inc. (Expo)." },
  { name: "Expo Local Authentication", license: "MIT", notice: "Copyright © 650 Industries, Inc. (Expo)." },
  { name: "Expo Secure Store", license: "MIT", notice: "Copyright © 650 Industries, Inc. (Expo)." },
  { name: "Expo Notifications", license: "MIT", notice: "Copyright © 650 Industries, Inc. (Expo)." },
  { name: "Expo Location", license: "MIT", notice: "Copyright © 650 Industries, Inc. (Expo)." },
  { name: "react-native-maps", license: "MIT", notice: "Copyright © Airbnb, Inc." },
  { name: "react-native-reanimated", license: "MIT", notice: "Copyright © Software Mansion." },
  { name: "react-native-gesture-handler", license: "MIT", notice: "Copyright © Software Mansion." },
  { name: "react-native-safe-area-context", license: "MIT", notice: "Copyright © Th3rd Wave." },
  { name: "@gorhom/bottom-sheet", license: "MIT", notice: "Copyright © Mo Gorhom." },
  { name: "react-native-svg", license: "MIT", notice: "Copyright © Software Mansion." },
  { name: "zustand", license: "MIT", notice: "Copyright © Poimandres." },
  { name: "socket.io-client", license: "MIT", notice: "Copyright © Guillermo Rauch." },
  { name: "sonner-native", license: "MIT", notice: "Copyright © Emil Kowalski." },
  { name: "react-native-paystack-webview", license: "MIT", notice: "Copyright © Just-Incredible." },
  { name: "@expo/vector-icons", license: "MIT", notice: "Copyright © 650 Industries, Inc. (Expo). Glyphs from Ionicons, Material Icons, Material Community Icons under their respective licenses." },
];

export default function OssScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={<ScreenHeader title="Open-source licenses" onBack={() => router.back()} />}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Gaznger is built on open-source software. Below are the libraries we
          ship in this app and their respective licenses.
        </Text>
        <View style={styles.list}>
          {LIBS.map((l) => (
            <View key={l.name} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.name}>{l.name}</Text>
                <Text style={styles.license}>{l.license}</Text>
              </View>
              <Text style={styles.notice}>{l.notice}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.outro}>
          For full license texts and complete dependency trees including
          transitive deps, please contact support@gaznger.com.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s6,
      gap: theme.space.s3,
    },
    intro: {
      ...theme.type.body,
      color: theme.fgMuted,
      marginTop: theme.space.s3,
    },
    list: {
      gap: theme.space.s2,
    },
    row: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius.md,
      padding: theme.space.s3,
      gap: 4,
    },
    rowHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    name: {
      ...theme.type.bodyLg,
      fontWeight: "700",
      color: theme.fg,
    },
    license: {
      ...theme.type.micro,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    notice: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    outro: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: theme.space.s3,
    },
  });
