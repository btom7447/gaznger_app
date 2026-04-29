import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { BottomSheet, BottomSheetRef } from "@/components/ui/primitives";

export interface AddressPickSheetRef {
  open: () => void;
  close: () => void;
}

export interface PickableAddress {
  _id: string;
  label: string;
  street?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface AddressPickSheetProps {
  addresses: PickableAddress[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

/**
 * Bottom sheet for picking from saved addresses. Includes an "Add new
 * address" affordance that closes the sheet and routes to address-book.
 */
const AddressPickSheet = forwardRef<AddressPickSheetRef, AddressPickSheetProps>(
  ({ addresses, selectedId, onChange }, ref) => {
    const theme = useTheme();
    const router = useRouter();
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

    const handleAddNew = () => {
      sheetRef.current?.close();
      setTimeout(() => router.push("/(screens)/address-book" as never), 200);
    };

    return (
      <BottomSheet ref={sheetRef} snapPoints={["70%"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Pick an address</Text>
          <Text style={styles.sub}>
            Choose where the rider should pick up the empty cylinder and
            return your full one.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {addresses.map((a) => {
            const isSel = a._id === selectedId;
            return (
              <Pressable
                key={a._id}
                onPress={() => handleSelect(a._id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSel }}
                accessibilityLabel={`${a.label}${a.street ? `: ${a.street}` : ""}`}
                style={({ pressed }) => [
                  styles.row,
                  isSel && styles.rowSelected,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.iconTile}>
                  <Ionicons
                    name="home-outline"
                    size={18}
                    color={isSel ? theme.primary : theme.fgMuted}
                  />
                </View>
                <View style={styles.body}>
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: isSel ? theme.primary : theme.fg },
                    ]}
                    numberOfLines={1}
                  >
                    {a.label}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[a.street, a.city].filter(Boolean).join(", ") ||
                      "Tap to refine"}
                  </Text>
                </View>
                {isSel ? (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            onPress={handleAddNew}
            accessibilityRole="button"
            accessibilityLabel="Add a new address"
            style={({ pressed }) => [
              styles.addNew,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="add" size={18} color={theme.primary} />
            <Text style={styles.addNewText}>Add a new address</Text>
          </Pressable>
        </ScrollView>
      </BottomSheet>
    );
  }
);

AddressPickSheet.displayName = "AddressPickSheet";

export default AddressPickSheet;

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
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, gap: 2 },
    rowLabel: {
      ...theme.type.body,
      fontWeight: "800",
    },
    rowSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    addNew: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderColor: theme.borderStrong,
      borderWidth: 1,
      borderStyle: "dashed",
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.s3,
      marginTop: theme.space.s2,
    },
    addNewText: {
      ...theme.type.body,
      color: theme.primary,
      fontWeight: "700",
    },
  });
