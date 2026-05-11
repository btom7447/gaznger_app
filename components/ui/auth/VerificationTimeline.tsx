import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

export interface VerificationStep {
  /** Ionicon name when step is pending or active. Done state shows a check. */
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  /** State machine: done → active → pending. */
  state: "done" | "active" | "pending";
}

interface Props {
  steps: VerificationStep[];
}

/**
 * Vertical step rail used by the rider/vendor verification kickoff
 * screens. Each step shows a circular icon (filled+check when done,
 * outlined+primary when active, muted when pending) connected by a
 * vertical bar that goes solid primary up to the last completed step.
 */
export default function VerificationTimeline({ steps }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View>
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const iconColor =
          s.state === "done"
            ? theme.fgOnPrimary
            : s.state === "active"
            ? theme.primary
            : theme.fgMuted;
        const iconBg =
          s.state === "done"
            ? theme.primary
            : s.state === "active"
            ? theme.primaryTint
            : theme.bgMuted;
        const railColor = s.state === "done" ? theme.primary : theme.border;
        return (
          <View key={s.label} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: iconBg },
                  s.state === "active" && {
                    borderWidth: 2,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <Ionicons
                  name={s.state === "done" ? "checkmark" : s.icon}
                  size={18}
                  color={iconColor}
                />
              </View>
              {!isLast ? (
                <View style={[styles.bar, { backgroundColor: railColor }]} />
              ) : null}
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>{s.label}</Text>
              <Text style={styles.sub}>{s.sub}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: theme.space.s3 + 2,
      paddingBottom: theme.space.s4 + 2,
    },
    rail: {
      width: 36,
      alignItems: "center",
    },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    bar: {
      width: 2,
      flex: 1,
      minHeight: 14,
      marginTop: 4,
    },
    body: {
      flex: 1,
      paddingTop: 7,
      gap: 3,
    },
    label: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    sub: {
      ...theme.type.caption,
      color: theme.fgMuted,
      lineHeight: 17,
    },
  });
