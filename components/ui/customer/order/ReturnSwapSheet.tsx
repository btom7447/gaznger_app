import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";
import {
  BottomSheet,
  BottomSheetRef,
  Button,
} from "@/components/ui/primitives";

export interface ReturnSwapSheetRef {
  open: () => void;
  close: () => void;
}

interface ReturnSwapSheetProps {
  /** Currently picked ISO timestamp (null = not yet picked). */
  value: string | null;
  onChange: (iso: string) => void;
}

const DAYS_AHEAD = 7;
const HOUR_START = 8; // 8am
const HOUR_END = 22; // 10:30pm — last slot at 22:30

/** Strip H/M/S/ms so two dates compare equal when they're the same calendar day. */
function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function buildDays(now: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

type SlotGroup = "Morning" | "Afternoon" | "Evening" | "Night";

function buildTimeSlots(day: Date, now: Date): Date[] {
  const ms30 = 30 * 60 * 1000;
  const dayStart = new Date(day);
  dayStart.setHours(HOUR_START, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(HOUR_END, 30, 0, 0);

  // For "today", clamp to the next valid 30-min increment + 30-min lead.
  const isToday = isSameDay(day, now);
  let cursor = dayStart;
  if (isToday) {
    const nextAvail = new Date(now.getTime() + ms30);
    const remainder = nextAvail.getMinutes() % 30;
    if (remainder !== 0) {
      nextAvail.setMinutes(nextAvail.getMinutes() + (30 - remainder));
    }
    nextAvail.setSeconds(0);
    nextAvail.setMilliseconds(0);
    if (nextAvail > cursor) cursor = nextAvail;
  }

  const slots: Date[] = [];
  for (let t = cursor.getTime(); t <= dayEnd.getTime(); t += ms30) {
    slots.push(new Date(t));
  }
  return slots;
}

/**
 * Bucket flat time slots into the same groupings as ScheduleSheet:
 * Morning (<12pm), Afternoon (12–5pm), Evening (5–9pm), Night (9pm–close).
 */
function groupTimeSlots(
  slots: Date[]
): { group: SlotGroup; slots: Date[] }[] {
  const morning: Date[] = [];
  const afternoon: Date[] = [];
  const evening: Date[] = [];
  const night: Date[] = [];
  for (const d of slots) {
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

function fmtDayChip(d: Date, now: Date): { primary: string; secondary: string } {
  if (isSameDay(d, now)) return { primary: "Today", secondary: "" };
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(d, tomorrow)) return { primary: "Tomorrow", secondary: "" };
  return {
    primary: d.toLocaleDateString("en-NG", { weekday: "short" }),
    secondary: d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
  };
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Date + time picker for the return-swap leg. Two stacked sections:
 *   1. Date chips (Today, Tomorrow, then weekday + dd-MMM for the next 5 days)
 *   2. Time chips for the picked date (08:00 → 22:30 in 30-min increments,
 *      with past times filtered out for "Today")
 *
 * Confirm disabled until BOTH date and time are picked. Designed for
 * single-trip return scheduling — different from the today-only Delivery
 * sheet (which is the rider's first arrival).
 */
const ReturnSwapSheet = forwardRef<ReturnSwapSheetRef, ReturnSwapSheetProps>(
  ({ value, onChange }, ref) => {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const sheetRef = useRef<BottomSheetRef>(null);

    const now = useMemo(() => new Date(), []);
    const days = useMemo(() => buildDays(now), [now]);

    const initialDate = value ? startOfDay(new Date(value)) : days[0];
    const [pickedDate, setPickedDate] = useState<Date>(initialDate);
    const [pickedISO, setPickedISO] = useState<string | null>(value);

    useImperativeHandle(
      ref,
      () => ({
        open: () => sheetRef.current?.snapToIndex(0),
        close: () => sheetRef.current?.close(),
      }),
      []
    );

    const timeSlots = useMemo(
      () => buildTimeSlots(pickedDate, now),
      [pickedDate, now]
    );
    const timeGroups = useMemo(() => groupTimeSlots(timeSlots), [timeSlots]);

    const handlePickDate = (d: Date) => {
      setPickedDate(d);
      // If the previously-picked time is no longer valid for the new date
      // (e.g. switched to "Today" and the chosen time is in the past),
      // clear it so the user has to re-pick.
      if (pickedISO) {
        const prev = new Date(pickedISO);
        const stillValid = buildTimeSlots(d, now).some(
          (s) => s.getTime() === prev.getTime()
        );
        if (!stillValid) setPickedISO(null);
      }
    };

    const handlePickTime = (slot: Date) => {
      setPickedISO(slot.toISOString());
    };

    const handleConfirm = () => {
      if (pickedISO) {
        onChange(pickedISO);
        sheetRef.current?.close();
      }
    };

    return (
      <BottomSheet
        ref={sheetRef}
        snapPoints={["85%"]}
        contentStyle={styles.sheetContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Schedule return swap</Text>
          <Text style={styles.sub}>
            Pick a day and time for the rider to come back for your empty
            cylinder.
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.groupLabel}>DAY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
          >
            {days.map((d) => {
              const isSel = isSameDay(d, pickedDate);
              const { primary, secondary } = fmtDayChip(d, now);
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => handlePickDate(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={`${primary}${secondary ? ` ${secondary}` : ""}`}
                  style={({ pressed }) => [
                    styles.dayChip,
                    isSel && styles.dayChipSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayPrimary,
                      { color: isSel ? "#fff" : theme.fg },
                    ]}
                  >
                    {primary}
                  </Text>
                  {secondary ? (
                    <Text
                      style={[
                        styles.daySecondary,
                        {
                          color: isSel
                            ? "rgba(255,255,255,0.85)"
                            : theme.fgMuted,
                        },
                      ]}
                    >
                      {secondary}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {timeSlots.length === 0 ? (
            <>
              <Text
                style={[styles.groupLabel, { marginTop: theme.space.s4 }]}
              >
                TIME
              </Text>
              <Text style={styles.emptyText}>
                No slots left for this day. Pick another day.
              </Text>
            </>
          ) : (
            timeGroups.map((g, i) => (
              <View
                key={g.group}
                style={[
                  styles.timeGroup,
                  i === 0 && { marginTop: theme.space.s4 },
                ]}
              >
                <Text style={styles.groupLabel}>{g.group.toUpperCase()}</Text>
                <View style={styles.timeRow}>
                  {g.slots.map((slot) => {
                    const iso = slot.toISOString();
                    const isSel = iso === pickedISO;
                    return (
                      <Pressable
                        key={iso}
                        onPress={() => handlePickTime(slot)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSel }}
                        accessibilityLabel={fmtTime(slot)}
                        style={({ pressed }) => [
                          styles.timeChip,
                          isSel && styles.timeChipSelected,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeText,
                            { color: isSel ? "#fff" : theme.fg },
                          ]}
                        >
                          {fmtTime(slot)}
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
            disabled={!pickedISO}
            onPress={handleConfirm}
          >
            Confirm return time
          </Button>
        </View>
      </BottomSheet>
    );
  }
);

ReturnSwapSheet.displayName = "ReturnSwapSheet";

export default ReturnSwapSheet;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /**
     * Override the BottomSheet primitive's default content padding so
     * the footer sits flush at the bottom edge. The ScrollView's
     * `flex: 1` then reliably bounds itself to (sheet height − header −
     * footer), which is what keeps the Confirm CTA on screen even when
     * the time list is long. Without this override the sheet's padding
     * + the BottomSheetView's flex behaviour can push the footer below
     * the visible area on smaller phones.
     */
    sheetContent: {
      flex: 1,
      paddingHorizontal: theme.space.s4,
      paddingTop: 0,
      paddingBottom: theme.space.s4,
    },
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
    scroll: { flex: 1 },
    scrollContent: {
      paddingBottom: theme.space.s3,
    },
    groupLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      marginBottom: theme.space.s2,
    },
    dayRow: {
      flexDirection: "row",
      gap: theme.space.s2,
      paddingRight: theme.space.s2,
    },
    dayChip: {
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s2 + 2,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      minWidth: 76,
      gap: 2,
    },
    dayChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    dayPrimary: {
      ...theme.type.body,
      fontWeight: "800",
    },
    daySecondary: {
      ...theme.type.caption,
    },
    timeGroup: {
      gap: theme.space.s2,
      marginTop: theme.space.s3,
    },
    timeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.s2,
    },
    timeChip: {
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s2 + 2,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      minWidth: 84,
      alignItems: "center",
    },
    timeChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    timeText: {
      ...theme.type.body,
      ...theme.type.money,
      fontWeight: "700",
    },
    emptyText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      paddingVertical: theme.space.s3,
    },
    /**
     * Sticky footer holding the Confirm CTA. Sits OUTSIDE the
     * ScrollView in the column flex layout, so it stays visible
     * regardless of how long the time-slot grid scrolls. The hairline
     * top border separates it visually from the scrolling content
     * above.
     */
    footer: {
      paddingTop: theme.space.s3,
      paddingBottom: theme.space.s2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
      backgroundColor: theme.surfaceElevated,
    },
  });
