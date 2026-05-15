import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Vertical 11-step timeline for a bulk fuel purchase (v6 hard rule).
 *
 * Layout per row:
 *   [dot]──vertical line──[dot]   (connecting line drawn between
 *   ↓                              consecutive dot midpoints)
 *   step label              timestamp + optional note
 *
 * Three dot states:
 *   - done    : filled primary disc with a subtle ring
 *   - active  : filled primary disc with pulsing ring (current step)
 *   - future  : hollow muted disc
 *
 * Order: STEP_ORDER on the server (requested → offloaded). Each row
 * pulls its timestamp from the `timeline[]` log when the step has
 * happened. Future rows show only the label.
 *
 * Pure presentational — caller passes the data; this component has
 * no fetching responsibility.
 */

export interface TimelineEntry {
  step: string;
  at: string; // ISO timestamp
  by: "plant" | "vendor" | "driver" | "system";
  note?: string;
}

export interface BulkTrackerTimelineProps {
  /** Canonical order of steps (length 11). */
  stepOrder: string[];
  /** Server-stamped transitions to date. */
  timeline: TimelineEntry[];
  /** Current step pointer; defaults to last entry in timeline. */
  currentStep?: string;
}

const STEP_LABELS: Record<string, string> = {
  requested: "Requested",
  acknowledged: "Acknowledged",
  paid: "Paid",
  allocated: "Allocated",
  truck_scheduled: "Truck scheduled",
  driver_verified: "Driver verified",
  loading: "Loading at depot",
  dispatched: "Dispatched",
  in_transit: "In transit",
  at_station: "At station",
  offloaded: "Offloaded",
};

function fmtTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const time = d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
    if (isToday) return `Today · ${time}`;
    const dateStr = d.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
    });
    return `${dateStr} · ${time}`;
  } catch {
    return "—";
  }
}

export default function BulkTrackerTimeline({
  stepOrder,
  timeline,
  currentStep,
}: BulkTrackerTimelineProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Build a lookup: step → latest entry (last write wins on dupes).
  const entryByStep = useMemo(() => {
    const m = new Map<string, TimelineEntry>();
    for (const e of timeline) m.set(e.step, e);
    return m;
  }, [timeline]);

  // Derive current index. Prefer explicit currentStep; otherwise use
  // the highest-index step we have an entry for.
  const currentIndex = useMemo(() => {
    if (currentStep) {
      const i = stepOrder.indexOf(currentStep);
      if (i >= 0) return i;
    }
    let max = -1;
    for (const e of timeline) {
      const i = stepOrder.indexOf(e.step);
      if (i > max) max = i;
    }
    return max;
  }, [currentStep, stepOrder, timeline]);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Bulk purchase timeline, step ${currentIndex + 1} of ${stepOrder.length}.`}
    >
      {stepOrder.map((stepKey, i) => {
        const entry = entryByStep.get(stepKey);
        const isDone = i < currentIndex || !!entry;
        const isActive = i === currentIndex;
        const isLast = i === stepOrder.length - 1;
        const label = STEP_LABELS[stepKey] ?? stepKey;

        return (
          <View key={stepKey} style={styles.row}>
            <View style={styles.gutter}>
              <View
                style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isActive && styles.dotActive,
                ]}
              >
                {isDone && !isActive ? (
                  <View style={styles.dotInner} />
                ) : null}
                {isActive ? <View style={styles.dotInnerActive} /> : null}
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.line,
                    isDone && styles.lineDone,
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.body}>
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.label,
                    isActive && styles.labelActive,
                    !isDone && !isActive && styles.labelFuture,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
              {entry ? (
                <Text style={styles.stamp} numberOfLines={1}>
                  {fmtTimestamp(entry.at)}
                </Text>
              ) : isActive ? (
                <Text style={styles.activeHint} numberOfLines={1}>
                  In progress
                </Text>
              ) : null}
              {entry?.note ? (
                <Text style={styles.note} numberOfLines={2}>
                  {entry.note}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const DOT_SIZE = 16;
const GUTTER_WIDTH = 28;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      paddingVertical: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      minHeight: 56,
    },
    gutter: {
      width: GUTTER_WIDTH,
      alignItems: "center",
      paddingTop: 2,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    dotDone: {
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    dotActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryTint,
    },
    dotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.fgOnPrimary,
    },
    dotInnerActive: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.primary,
    },
    line: {
      flex: 1,
      width: 2,
      backgroundColor: theme.border,
      marginVertical: 2,
    },
    lineDone: {
      backgroundColor: theme.primary,
    },
    body: {
      flex: 1,
      paddingLeft: 12,
      paddingBottom: 16,
      gap: 2,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    label: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    labelActive: {
      color: theme.primary,
    },
    labelFuture: {
      color: theme.fgMuted,
      fontWeight: "500",
    },
    stamp: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    activeHint: {
      ...theme.type.caption,
      color: theme.primary,
      fontWeight: "700",
    },
    note: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 4,
    },
  });
