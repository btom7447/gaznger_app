import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { StyleSheet, ViewStyle } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Theme, useTheme } from "@/constants/theme";

export interface BottomSheetRef {
  /** Snap to a specific snap-point index (and present if not visible). */
  snapToIndex: (index: number) => void;
  /** Dismiss the sheet. */
  close: () => void;
  /** Present and expand to highest snap. */
  expand: () => void;
}

interface BottomSheetProps {
  /** Heights as numbers (px) or `${number}%` strings, smallest to largest. */
  snapPoints: (number | `${number}%`)[];
  initialSnap?: number;
  /** Called on snap change. -1 = closed. */
  onChange?: (snapIndex: number) => void;
  /** Backdrop opacity (0–1). Default 0.5 light / 0.7 dark. */
  backdropOpacity?: number;
  /** Allow tap-backdrop-to-close. Default true. */
  dismissable?: boolean;
  /** Adjust radius — default theme.radius.xl. */
  cornerRadius?: number;
  /** Show backdrop. Default true. */
  withBackdrop?: boolean;
  /** Style on the inner content view. */
  contentStyle?: ViewStyle;
  children: React.ReactNode;
}

/**
 * Wraps @gorhom/bottom-sheet's BottomSheetModal — modals are portaled to
 * the root via BottomSheetModalProvider (mounted in app/_layout.tsx), so
 * they always anchor to the bottom of the screen regardless of where the
 * caller mounts them in the JSX tree.
 *
 * Imperative API:
 *   ref.expand()    — present the sheet at its highest snap point
 *   ref.snapToIndex — present and snap to a specific index
 *   ref.close()     — dismiss
 */
const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      snapPoints,
      initialSnap = 0,
      onChange,
      backdropOpacity,
      dismissable = true,
      cornerRadius,
      withBackdrop = true,
      contentStyle,
      children,
    },
    ref
  ) => {
    const theme = useTheme();
    const sheetRef = useRef<BottomSheetModal>(null);
    const styles = useMemo(() => makeStyles(theme), [theme]);

    useImperativeHandle(
      ref,
      () => ({
        snapToIndex: (i: number) => {
          sheetRef.current?.present();
          sheetRef.current?.snapToIndex(i);
        },
        expand: () => {
          sheetRef.current?.present();
          sheetRef.current?.expand();
        },
        close: () => sheetRef.current?.dismiss(),
      }),
      []
    );

    const memoSnapPoints = useMemo(() => snapPoints, [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={backdropOpacity ?? (theme.mode === "dark" ? 0.7 : 0.5)}
          pressBehavior={dismissable ? "close" : "none"}
        />
      ),
      [backdropOpacity, dismissable, theme.mode]
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        index={initialSnap}
        snapPoints={memoSnapPoints}
        onChange={onChange}
        enablePanDownToClose={dismissable}
        backdropComponent={withBackdrop ? renderBackdrop : undefined}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={[
          styles.bg,
          {
            borderTopLeftRadius: cornerRadius ?? theme.radius.xl,
            borderTopRightRadius: cornerRadius ?? theme.radius.xl,
          },
        ]}
      >
        <BottomSheetView style={[styles.content, contentStyle]}>
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

BottomSheet.displayName = "BottomSheet";

export default BottomSheet;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bg: {
      backgroundColor: theme.surfaceElevated,
    },
    handle: {
      backgroundColor: theme.borderStrong,
      width: 40,
      height: 4,
      borderRadius: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s5,
    },
  });
