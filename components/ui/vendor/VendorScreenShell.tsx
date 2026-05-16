import React, { useEffect, useMemo, ReactNode } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Theme, useTheme } from "@/constants/theme";
import StationSwitcher from "./StationSwitcher";
import { useVendorStationStore } from "@/store/useVendorStationStore";
import { api } from "@/lib/api";

interface VendorStationApiRow {
  _id: string;
  name: string;
}

/**
 * Shared frame for every vendor screen.
 *
 * Top bar: station switcher chip (left) + optional right-side slot.
 * Body: scroll-or-view container with theme background.
 *
 * Also responsible for hydrating useVendorStationStore on first mount
 * — the store is per-session and lazily populated from
 * `GET /api/vendor/stations`. Children read from the store; this
 * shell handles the fetch so every vendor screen doesn't repeat it.
 */
interface Props {
  title?: string;
  eyebrow?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  contentStyle?: ViewStyle;
  /**
   * Hide the station-switcher chip from the top-left of the header.
   * Today screen uses this so its hero card owns the header row.
   */
  hideStationSwitcher?: boolean;
}

export default function VendorScreenShell({
  title,
  eyebrow,
  rightSlot,
  children,
  contentStyle,
  hideStationSwitcher,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const setStations = useVendorStationStore((s) => s.setStations);
  const hasStations = useVendorStationStore((s) => s.stations.length > 0);

  // One-shot hydration of the station list. Subsequent screens re-use
  // the cached list without re-fetching. A station-changed event from
  // settings (create / rename) should call setStations directly.
  useEffect(() => {
    if (hasStations) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ stations: VendorStationApiRow[] }>(
          "/api/vendor/stations",
        );
        if (cancelled) return;
        const list = (res?.stations ?? []).map((s) => ({
          id: s._id,
          name: s.name,
        }));
        setStations(list);
      } catch {
        // Non-fatal — vendor with zero stations will see the "No station"
        // placeholder chip until they create one via signup or settings.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasStations, setStations]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.bg }]}
      edges={["top"]}
    >
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {hideStationSwitcher ? null : <StationSwitcher />}
          {/* When the station chip is hidden the title takes its slot
              on the same row as the rightSlot (Today does this so the
              "Today" + notification icon sit on one row per design). */}
          {hideStationSwitcher && title ? (
            <Text style={styles.titleInline}>{title}</Text>
          ) : null}
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        </View>
        {rightSlot ? <View>{rightSlot}</View> : null}
      </View>

      {title && !hideStationSwitcher ? (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
        </View>
      ) : null}

      <View style={[styles.body, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 12,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    eyebrow: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    titleRow: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    title: {
      ...theme.type.h1,
      color: theme.fg,
      letterSpacing: -0.4,
    },
    titleInline: {
      ...theme.type.h1,
      color: theme.fg,
      letterSpacing: -0.4,
    },
    body: { flex: 1 },
  });
