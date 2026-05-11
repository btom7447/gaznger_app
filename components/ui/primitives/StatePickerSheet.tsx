import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import { NIGERIA_STATES, type NigeriaState } from "@/constants/nigeriaStates";
import BottomSheet, { BottomSheetRef } from "./BottomSheet";

export interface StatePickerSheetRef {
  open: () => void;
  close: () => void;
}

interface Props {
  /** Currently selected state — highlighted in the list. */
  selected?: NigeriaState | null;
  /** Fires when the user picks a state; sheet closes automatically. */
  onSelect: (state: NigeriaState) => void;
  /** Override the default list (e.g. for testing or limited rollouts). */
  states?: NigeriaState[];
}

/**
 * Bottom-sheet picker for Nigerian states. Used by the vendor address
 * sheet + anywhere else we need a state dropdown. Same UX shape as
 * CountryPickerSheet so the muscle memory carries over.
 *
 * Search is case-insensitive on `label` so typing "lago" finds Lagos.
 */
const StatePickerSheet = forwardRef<StatePickerSheetRef, Props>(
  function StatePickerSheet(
    { selected, onSelect, states = NIGERIA_STATES },
    ref
  ) {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const sheetRef = useRef<BottomSheetRef>(null);
    const [query, setQuery] = useState("");

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.expand(),
      close: () => sheetRef.current?.close(),
    }));

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return states;
      return states.filter((s) => s.label.toLowerCase().includes(q));
    }, [states, query]);

    const handleSelect = (s: NigeriaState) => {
      onSelect(s);
      sheetRef.current?.close();
      setQuery("");
    };

    return (
      <BottomSheet
        ref={sheetRef}
        snapPoints={["75%"]}
        initialSnap={0}
        contentStyle={styles.content}
      >
        <Text style={styles.title}>Choose state</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={theme.fgMuted} />
          <TextInput
            placeholder="Search state"
            placeholderTextColor={theme.fgMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selected?.code === item.code;
            return (
              <Pressable
                onPress={() => handleSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.85 },
                  isSelected && styles.rowSelected,
                ]}
              >
                <Text style={styles.label}>{item.label}</Text>
                {isSelected ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={theme.primary}
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    );
  }
);

export default StatePickerSheet;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s4,
      gap: theme.space.s3,
    },
    title: {
      ...theme.type.h2,
      color: theme.fg,
    },
    searchRow: {
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.s3,
      gap: theme.space.s2,
    },
    searchInput: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      paddingVertical: 0,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s3,
      borderRadius: theme.radius.md,
    },
    rowSelected: {
      backgroundColor: theme.primaryTint,
    },
    label: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "600",
    },
  });
