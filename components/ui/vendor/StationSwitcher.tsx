import React, { useMemo, useRef, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Theme, useTheme } from "@/constants/theme";
import { useVendorStationStore } from "@/store/useVendorStationStore";

/**
 * Station-switcher chip — top-bar chrome on every vendor screen.
 *
 * Multi-station vendors own >1 station; the chip shows the active
 * station's short label and opens a sheet to swap. Single-station
 * vendors still get the chip (un-tappable) so the active station is
 * always glanceable.
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
  const snapPoints = useMemo(() => ["40%", "70%"], []);

  const active = useMemo(
    () => stations.find((s) => s.id === activeStationId) ?? null,
    [stations, activeStationId],
  );

  const onPress = useCallback(() => {
    if (stations.length <= 1) return;
    sheetRef.current?.present();
  }, [stations.length]);

  const onPick = useCallback(
    (id: string) => {
      setActiveStation(id);
      sheetRef.current?.dismiss();
    },
    [setActiveStation],
  );

  // No active station yet — render an inert placeholder so the chrome
  // height is stable (avoids a layout shift on first data load).
  if (!active) {
    return (
      <View style={[styles.chip, styles.chipMuted]}>
        <Ionicons name="business-outline" size={14} color={theme.fgMuted} />
        <Text style={styles.labelMuted}>No station</Text>
      </View>
    );
  }

  const label = active.shortLabel ?? active.name.split(/\s+/)[0] ?? active.name;
  const tappable = stations.length > 1;

  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole={tappable ? "button" : "text"}
        accessibilityLabel={
          tappable
            ? `Active station: ${active.name}. Tap to switch.`
            : `Active station: ${active.name}.`
        }
        hitSlop={6}
        style={({ pressed }) => [
          styles.chip,
          pressed && tappable && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="business" size={14} color={theme.primary} />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {tappable ? (
          <Ionicons name="chevron-down" size={14} color={theme.fgMuted} />
        ) : null}
      </Pressable>

      {tappable ? (
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={snapPoints}
          backgroundStyle={{ backgroundColor: theme.bg }}
          handleIndicatorStyle={{ backgroundColor: theme.fgMuted }}
        >
          <View style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>Switch station</Text>
            {stations.map((s) => {
              const isActive = s.id === activeStationId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onPick(s.id)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.85 },
                    isActive && { backgroundColor: theme.primaryTint },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isActive ? `${s.name}, currently active` : s.name
                  }
                >
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
          </View>
        </BottomSheetModal>
      ) : null}
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
      maxWidth: 140,
    },
    labelMuted: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    sheetBody: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      gap: 8,
    },
    sheetTitle: {
      ...theme.type.h2,
      color: theme.fg,
      marginBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.bgMuted,
    },
    rowText: { flex: 1 },
    rowName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "600",
    },
  });
