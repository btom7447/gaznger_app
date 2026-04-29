import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import { BottomSheet, BottomSheetRef } from "@/components/ui/primitives";

export interface PickerSheetRef {
  open: () => void;
  close: () => void;
}

export interface PickerOption {
  /** Stable id. */
  id: string;
  /** Primary text shown on the row. */
  label: string;
  /** Optional secondary text. */
  sub?: string;
}

interface PickerSheetProps {
  title: string;
  /** Optional intro line under the title. */
  description?: string;
  options: PickerOption[];
  value: string | null;
  onChange: (id: string) => void;
}

/**
 * Generic single-select bottom-sheet picker. Used by Cylinder details
 * (Brand / Valve type / Age / Last test date). Auto-closes on selection.
 */
const PickerSheet = forwardRef<PickerSheetRef, PickerSheetProps>(
  ({ title, description, options, value, onChange }, ref) => {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const sheetRef = useRef<BottomSheetRef>(null);

    useImperativeHandle(
      ref,
      () => ({
        open: () => sheetRef.current?.snapToIndex(0),
        close: () => sheetRef.current?.close(),
      }),
      []
    );

    const handleSelect = (id: string) => {
      onChange(id);
      sheetRef.current?.close();
    };

    return (
      <BottomSheet ref={sheetRef} snapPoints={["70%"]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {options.map((opt) => {
            const isSel = opt.id === value;
            return (
              <Pressable
                key={opt.id}
                onPress={() => handleSelect(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSel }}
                accessibilityLabel={`${opt.label}${opt.sub ? `. ${opt.sub}` : ""}`}
                style={({ pressed }) => [
                  styles.row,
                  isSel && styles.rowSelected,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.body}>
                  <Text
                    style={[
                      styles.label,
                      { color: isSel ? theme.primary : theme.fg },
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {opt.sub ? (
                    <Text style={styles.sub} numberOfLines={2}>
                      {opt.sub}
                    </Text>
                  ) : null}
                </View>
                {isSel ? (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    );
  }
);

PickerSheet.displayName = "PickerSheet";

export default PickerSheet;

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
    description: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    list: {
      paddingBottom: theme.space.s3,
      gap: theme.space.s2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
    },
    rowSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    body: { flex: 1, gap: 2 },
    label: {
      ...theme.type.body,
      fontWeight: "800",
    },
    sub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
  });
