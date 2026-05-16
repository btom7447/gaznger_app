import React, { useMemo, useRef, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Theme, useTheme } from "@/constants/theme";
import { useVendorStationStore } from "@/store/useVendorStationStore";

/**
 * Station-switcher chip — top-bar chrome on every vendor screen.
 *
 * Defaults to "All stations" scope (activeStationId === null). Vendors
 * pick a single station via the bottom sheet to filter Orders /
 * Supplies / Finance to that station; picking "All stations" again
 * clears the scope.
 *
 * The chip is always tappable — even with one station — so the
 * sheet can confirm which station the screen is scoped to.
 *
 * Mounts inside VendorScreenShell. Reads + writes useVendorStationStore.
 */
export default function StationSwitcher() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const stations = useVendorStationStore((s) => s.stations);
  const activeStationId = useVendorStationStore((s) => s.activeStationId);
  const setActiveStation = useVendorStationStore((s) => s.setActiveStation);

  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["50%", "85%"], []);

  const active = useMemo(
    () => stations.find((s) => s.id === activeStationId) ?? null,
    [stations, activeStationId],
  );

  const onPress = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  const onPick = useCallback(
    (id: string | null) => {
      setActiveStation(id);
      sheetRef.current?.dismiss();
    },
    [setActiveStation],
  );

  // No stations yet — render an inert placeholder so the chrome
  // height is stable while we wait for /vendor/stations to land.
  if (stations.length === 0) {
    return (
      <View style={[styles.chip, styles.chipMuted]}>
        <Ionicons name="business-outline" size={14} color={theme.fgMuted} />
        <Text style={styles.labelMuted}>No station</Text>
      </View>
    );
  }

  const isAllStations = activeStationId === null;
  const chipLabel = isAllStations
    ? "All stations"
    : active?.shortLabel ?? active?.name.split(/\s+/)[0] ?? "Station";
  const chipIcon: keyof typeof Ionicons.glyphMap = isAllStations
    ? "globe-outline"
    : "business";

  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          isAllStations
            ? "Showing all stations. Tap to scope to one."
            : `Scoped to ${active?.name}. Tap to switch.`
        }
        hitSlop={6}
        style={({ pressed }) => [
          styles.chip,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name={chipIcon} size={14} color={theme.primary} />
        <Text style={styles.label} numberOfLines={1}>
          {chipLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.fgMuted} />
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: theme.bg }}
        handleIndicatorStyle={{ backgroundColor: theme.fgMuted }}
      >
        <BottomSheetView style={styles.sheetBody}>
          <Text style={styles.sheetTitle}>Switch station</Text>
          <Text style={styles.sheetHint}>
            Pick "All stations" to see every station in this app.
          </Text>

          <Pressable
            onPress={() => onPick(null)}
            style={({ pressed }) => [
              styles.row,
              pressed && { opacity: 0.85 },
              isAllStations && styles.rowActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isAllStations
                ? "All stations, currently active"
                : "All stations"
            }
          >
            <View style={styles.rowIconWrap}>
              <Ionicons
                name="globe-outline"
                size={18}
                color={theme.primary}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowName} numberOfLines={1}>
                All stations
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                Aggregate across {stations.length} station
                {stations.length === 1 ? "" : "s"}
              </Text>
            </View>
            {isAllStations ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.primary}
              />
            ) : null}
          </Pressable>

          {stations.map((s) => {
            const isActive = s.id === activeStationId;
            return (
              <Pressable
                key={s.id}
                onPress={() => onPick(s.id)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.85 },
                  isActive && styles.rowActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isActive ? `${s.name}, currently active` : s.name
                }
              >
                <View style={styles.rowIconWrap}>
                  <Ionicons
                    name="business"
                    size={18}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {s.name}
                  </Text>
                </View>
                {isActive ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor: theme.primary + "33",
    },
    chipMuted: {
      backgroundColor: theme.bgMuted,
      borderColor: theme.border,
    },
    label: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
      maxWidth: 160,
    },
    labelMuted: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    sheetBody: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
      gap: 8,
    },
    sheetTitle: {
      ...theme.type.h2,
      color: theme.fg,
      marginBottom: 4,
    },
    sheetHint: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: "transparent",
    },
    rowActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary + "44",
    },
    rowIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bg,
    },
    rowText: { flex: 1 },
    rowName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    rowSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 2,
    },
  });
