import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import { BottomSheet, BottomSheetRef } from "@/components/ui/primitives";

export type PhotoSource = "camera" | "library";

export interface PhotoPickSheetRef {
  open: () => void;
  close: () => void;
}

interface PhotoPickSheetProps {
  /**
   * Called when the user picks a source. The parent runs the actual
   * ImagePicker call AND closes the sheet (via the ref) once the picker
   * resolves — dismissing here racing with the picker launch causes the
   * picker to close itself on iOS.
   */
  onPick: (source: PhotoSource) => void;
  /** Optional title (defaults to "Add photo"). */
  title?: string;
}

/**
 * Two-card sheet — Take photo vs Choose from library, side by side.
 */
const PhotoPickSheet = forwardRef<PhotoPickSheetRef, PhotoPickSheetProps>(
  ({ onPick, title = "Add photo" }, ref) => {
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

    return (
      <BottomSheet ref={sheetRef} snapPoints={["38%"]}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.row}>
          <Pressable
            onPress={() => onPick("camera")}
            accessibilityRole="button"
            accessibilityLabel="Take photo with camera"
            style={({ pressed }) => [
              styles.card,
              pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={styles.iconTile}>
              <Ionicons name="camera-outline" size={26} color={theme.primary} />
            </View>
            <Text style={styles.cardLabel}>Take photo</Text>
            <Text style={styles.cardSub}>Use your camera</Text>
          </Pressable>

          <Pressable
            onPress={() => onPick("library")}
            accessibilityRole="button"
            accessibilityLabel="Choose from photo library"
            style={({ pressed }) => [
              styles.card,
              pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={styles.iconTile}>
              <Ionicons name="image-outline" size={26} color={theme.primary} />
            </View>
            <Text style={styles.cardLabel}>From library</Text>
            <Text style={styles.cardSub}>Pick an existing photo</Text>
          </Pressable>
        </View>
      </BottomSheet>
    );
  }
);

PhotoPickSheet.displayName = "PhotoPickSheet";

export default PhotoPickSheet;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    title: {
      ...theme.type.h2,
      color: theme.fg,
      marginBottom: theme.space.s4,
    },
    row: {
      flexDirection: "row",
      gap: theme.space.s3,
    },
    card: {
      flex: 1,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingVertical: theme.space.s4,
      paddingHorizontal: theme.space.s3,
      alignItems: "center",
      gap: theme.space.s2,
      minHeight: 130,
    },
    iconTile: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    cardLabel: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      textAlign: "center",
    },
    cardSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
      textAlign: "center",
    },
  });
