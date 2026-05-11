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
import BottomSheet, { BottomSheetRef } from "./BottomSheet";

export interface Country {
  /** ISO 3166-1 alpha-2 code, e.g. "NG". */
  code: string;
  /** Display name, e.g. "Nigeria". */
  name: string;
  /** Dial code with leading "+", e.g. "+234". */
  dialCode: string;
  /** Emoji flag. Renders cleanly on iOS; Android needs a font fallback that
   *  modern devices ship with — degraded sets show the ISO code instead. */
  flag: string;
}

export interface CountryPickerSheetRef {
  open: () => void;
  close: () => void;
}

interface Props {
  /** Currently selected country (highlighted in the list). */
  selected?: Country;
  /** User picked a country — sheet closes automatically. */
  onSelect: (c: Country) => void;
  /** Filter the displayed list. Defaults to popular African + diaspora. */
  countries?: Country[];
}

/**
 * Bottom-sheet country/dial-code picker. Default list focuses on
 * Nigeria (the launch market) plus the most common diaspora origins
 * so customers travelling can still log in. Caller can pass a custom
 * `countries` list to widen the set.
 *
 * Search is case-insensitive across name + dial code so users can
 * type either "Nigeria" or "234".
 */
const DEFAULT_COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
];

const CountryPickerSheet = forwardRef<CountryPickerSheetRef, Props>(
  function CountryPickerSheet(
    { selected, onSelect, countries = DEFAULT_COUNTRIES },
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
      if (!q) return countries;
      return countries.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.dialCode.replace("+", "").includes(q.replace("+", ""))
      );
    }, [countries, query]);

    const handleSelect = (c: Country) => {
      onSelect(c);
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
        <Text style={styles.title}>Choose country</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={theme.fgMuted} />
          <TextInput
            placeholder="Search country or dial code"
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
          keyExtractor={(c) => c.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selected?.code === item.code;
            return (
              <Pressable
                onPress={() => handleSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name} ${item.dialCode}`}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.85 },
                  isSelected && styles.rowSelected,
                ]}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                <Text style={styles.dial}>{item.dialCode}</Text>
                {isSelected ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={theme.primary}
                    style={{ marginLeft: theme.space.s2 }}
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

export default CountryPickerSheet;

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
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s3,
      borderRadius: theme.radius.md,
      gap: theme.space.s3,
    },
    rowSelected: {
      backgroundColor: theme.primaryTint,
    },
    flag: {
      fontSize: 24,
    },
    name: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "600",
    },
    dial: {
      ...theme.type.bodySm,
      ...theme.type.money,
      color: theme.fgMuted,
      fontWeight: "700",
    },
  });
