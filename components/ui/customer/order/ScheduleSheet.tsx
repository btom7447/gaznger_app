import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";
import {
  BottomSheet,
  BottomSheetRef,
  Button,
} from "@/components/ui/primitives";

export interface ScheduleSheetRef {
  open: () => void;
  close: () => void;
}

interface ScheduleSheetProps {
  /** Currently picked ISO timestamp (start of the 30-min window). */
  value: string | null;
  onChange: (iso: string) => void;
}

/**
 * Today-only schedule picker — 30-minute headsup. User picks the START of
 * a 30-min window; we'll alert the rider 30 minutes before.
 *
 * Slots cluster by Morning (before 12pm), Afternoon (12–5pm), and
 * Evening (5–7pm) so users scan quickly. Past times are filtered out.
 *
 * Tomorrow / multi-day scheduling is intentionally out of scope for now —
 * flagged as a future feature.
 */
type SlotGroup = "Morning" | "Afternoon" | "Evening" | "Night";

function buildTodaySlots(now: Date): {
  group: SlotGroup;
  slots: Date[];
}[] {
  const ms30 = 30 * 60 * 1000;
  // First slot: round up to the next half hour, plus a 30-min lead so the
  // rider has notice. Past times are filtered out by construction.
  const first = new Date(now.getTime() + ms30);
  const minutes = first.getMinutes();
  const remainder = minutes % 30;
  if (remainder !== 0) {
    first.setMinutes(minutes + (30 - remainder));
  }
  first.setSeconds(0);
  first.setMilliseconds(0);

  // Operational window extends to 11pm — late-night swaps allowed; matching
  // stations are filtered downstream on the Stations screen by open hours.
  const cutoff = new Date(first);
  cutoff.setHours(23, 0, 0, 0);

  // If `first` already past the cutoff (after 11pm), no slots today.
  if (first.getTime() > cutoff.getTime()) return [];

  const all: Date[] = [];
  for (let t = first.getTime(); t <= cutoff.getTime(); t += ms30) {
    all.push(new Date(t));
  }

  const morning: Date[] = [];
  const afternoon: Date[] = [];
  const evening: Date[] = [];
  const night: Date[] = [];
  for (const d of all) {
    const h = d.getHours();
    if (h < 12) morning.push(d);
    else if (h < 17) afternoon.push(d);
    else if (h < 21) evening.push(d);
    else night.push(d);
  }
  return [
    ...(morning.length > 0 ? [{ group: "Morning" as const, slots: morning }] : []),
    ...(afternoon.length > 0 ? [{ group: "Afternoon" as const, slots: afternoon }] : []),
    ...(evening.length > 0 ? [{ group: "Evening" as const, slots: evening }] : []),
    ...(night.length > 0 ? [{ group: "Night" as const, slots: night }] : []),
  ];
}

function fmt(d: Date): string {
  return d.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const ScheduleSheet = forwardRef<ScheduleSheetRef, ScheduleSheetProps>(
  ({ value, onChange }, ref) => {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const sheetRef = useRef<BottomSheetRef>(null);

    const [picked, setPicked] = useState<string | null>(value);

    useImperativeHandle(
      ref,
      () => ({
        open: () => sheetRef.current?.snapToIndex(0),
        close: () => sheetRef.current?.close(),
      }),
      []
    );

    const groups = useMemo(() => buildTodaySlots(new Date()), []);
    const noSlotsToday = groups.length === 0;

    const handleConfirm = () => {
      if (picked) onChange(picked);
      sheetRef.current?.close();
    };

    return (
      <BottomSheet
        ref={sheetRef}
        snapPoints={["75%"]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Schedule pickup</Text>
          <Text style={styles.sub}>
            Pick a start time today — we'll give you a 30-minute headsup
            before the rider arrives.
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {noSlotsToday ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                No slots left today.
              </Text>
              <Text style={styles.emptyBody}>
                Today's delivery window has closed. Try "Now" instead, or
                check back tomorrow.
              </Text>
            </View>
          ) : (
            groups.map((g) => (
              <View key={g.group} style={styles.group}>
                <Text style={styles.groupLabel}>{g.group.toUpperCase()}</Text>
                <View style={styles.slotRow}>
                  {g.slots.map((d) => {
                    const iso = d.toISOString();
                    const isSel = iso === picked;
                    return (
                      <Pressable
                        key={iso}
                        onPress={() => setPicked(iso)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSel }}
                        accessibilityLabel={fmt(d)}
                        style={({ pressed }) => [
                          styles.slot,
                          isSel && styles.slotSelected,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotText,
                            { color: isSel ? "#fff" : theme.fg },
                          ]}
                        >
                          {fmt(d)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            full
            disabled={!picked || noSlotsToday}
            onPress={handleConfirm}
          >
            Confirm time
          </Button>
        </View>
      </BottomSheet>
    );
  }
);

ScheduleSheet.displayName = "ScheduleSheet";

export default ScheduleSheet;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      gap: 6,
      marginBottom: theme.space.s3,
    },
    title: {
      ...theme.type.h2,
      color: theme.fg,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.space.s3,
      gap: theme.space.s4,
    },
    group: { gap: theme.space.s2 },
    groupLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
    },
    slotRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.s2,
    },
    slot: {
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s2 + 2,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      minWidth: 76,
      alignItems: "center",
    },
    slotSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    slotText: {
      ...theme.type.body,
      ...theme.type.money,
      fontWeight: "700",
    },
    emptyWrap: {
      paddingVertical: theme.space.s5,
      alignItems: "center",
      gap: theme.space.s2,
    },
    emptyTitle: {
      ...theme.type.bodyLg,
      color: theme.fg,
      fontWeight: "800",
    },
    emptyBody: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
    },
    footer: {
      paddingTop: theme.space.s3,
    },
  });
