import React, { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import BottomSheet, { BottomSheetRef } from "./BottomSheet";

/**
 * Three-dot row trigger that opens an action sheet of choices.
 *
 * Used on Address book rows for Edit / Delete / Set as default. Pairs
 * with the swipe-to-reveal gesture on the same rows — both are wired
 * so users discover whichever feels natural (per UX call: "let's go
 * with both").
 *
 * Action sheet renders as a BottomSheetModal with auto-sized snap point
 * driven by content height (~56px per action + header padding).
 */
export interface KebabAction {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  /** Renders the action in error colour. Used for Delete. */
  danger?: boolean;
  onPress: () => void;
}

interface KebabMenuProps {
  actions: KebabAction[];
  /** Sheet header. Optional. Defaults to nothing. */
  title?: string;
  accessibilityLabel?: string;
}

export default function KebabMenu({
  actions,
  title,
  accessibilityLabel,
}: KebabMenuProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sheetRef = useRef<BottomSheetRef>(null);

  // Sheet height is computed from the action count so we don't reserve
  // unused space — 56px per row + 64 header + 32 padding + cancel row.
  const computedHeight = useMemo(() => {
    const headerH = title ? 64 : 32;
    const rowsH = actions.length * 56;
    const cancelH = 64;
    return headerH + rowsH + cancelH;
  }, [actions.length, title]);

  const handleAction = useCallback((onPress: () => void) => {
    // Close the sheet first, then run the action on the next tick so
    // any navigation triggered by the action doesn't fight the sheet
    // dismiss animation.
    sheetRef.current?.close();
    setTimeout(() => onPress(), 200);
  }, []);

  return (
    <>
      <Pressable
        onPress={() => sheetRef.current?.expand()}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? "More options"}
        accessibilityHint="Opens an action sheet"
        hitSlop={8}
        style={({ pressed }) => [styles.kebab, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="ellipsis-vertical" size={18} color={theme.fgMuted} />
      </Pressable>

      <BottomSheet ref={sheetRef} snapPoints={[computedHeight]}>
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
          </View>
        ) : null}

        {actions.map((action, idx) => {
          const color = action.danger ? theme.error : theme.fg;
          return (
            <Pressable
              key={`${action.label}-${idx}`}
              onPress={() => handleAction(action.onPress)}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { backgroundColor: theme.bgMuted },
              ]}
            >
              {action.icon ? (
                <Ionicons name={action.icon} size={20} color={color} />
              ) : null}
              <Text style={[styles.actionLabel, { color }]}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.cancelDivider} />
        <Pressable
          onPress={() => sheetRef.current?.close()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [
            styles.actionRow,
            pressed && { backgroundColor: theme.bgMuted },
          ]}
        >
          <Text style={[styles.actionLabel, styles.cancelLabel]}>Cancel</Text>
        </Pressable>
      </BottomSheet>
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    kebab: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s3,
      paddingBottom: theme.space.s3,
    },
    title: {
      ...theme.type.caption,
      color: theme.fgMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      fontWeight: "800",
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      paddingHorizontal: theme.space.s4,
      height: 56,
    },
    actionLabel: {
      ...theme.type.bodyLg,
      fontWeight: "600",
    },
    cancelDivider: {
      height: 8,
      backgroundColor: theme.bgMuted,
    },
    cancelLabel: {
      color: theme.fgMuted,
    },
  });
