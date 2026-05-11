import React, { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";

interface Props {
  /** Show the back arrow in the top-left. Default true. */
  showBack?: boolean;
  /** Override default router.back(). e.g. for skipping intermediate steps. */
  onBack?: () => void;
  /** Show "Need help?" footer link. Default true. */
  showHelp?: boolean;
  /** Tap handler for help — defaults to opening tel:/mailto: support. */
  onHelp?: () => void;
  /** Wrap content in ScrollView. Default true. */
  scrollable?: boolean;
  /** Padding around the body. Default 20 horizontal, 100 bottom (CTA reserve). */
  contentStyle?: ViewStyle;
  /** Status bar mode override. Default = inverse of theme. */
  statusBarStyle?: "light" | "dark" | "auto";
  children: React.ReactNode;
  /** Hide the StatusBar component entirely (e.g. when parent owns it). */
  hideStatusBar?: boolean;
  /** Background — default theme.bg. Override for splash hero etc. */
  background?: string;
  /**
   * Sticky footer slot — sits between the scrollable body and the
   * "Need help?" row so primary CTAs don't float over the content
   * (FloatingCTA's absolute positioning was covering the bottom of
   * forms). Pass a `<Button>` here on every signup/login surface.
   */
  footer?: React.ReactNode;
}

/**
 * Shared frame for every auth surface: safe-area aware, optional back
 * arrow + help link, status-bar contrast handled, KeyboardAvoidingView
 * wrapper so PIN/OTP inputs don't get covered. The (auth) Stack
 * `_layout.tsx` is a Stack with no tab bar — this container just
 * renders the per-screen chrome inside that.
 *
 * Help fallback opens a generic mailto so users always have an exit;
 * surfaces with their own support routing should override `onHelp`.
 */
export default function AuthScreenContainer({
  showBack = true,
  onBack,
  showHelp = true,
  onHelp,
  scrollable = true,
  contentStyle,
  statusBarStyle = "auto",
  hideStatusBar = false,
  background,
  footer,
  children,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
  };

  const handleHelp = () => {
    if (onHelp) {
      onHelp();
      return;
    }
    Linking.openURL("mailto:support@gaznger.com").catch(() => {});
  };

  const Body = scrollable ? ScrollView : View;
  const bodyProps = scrollable
    ? {
        keyboardShouldPersistTaps: "handled" as const,
        showsVerticalScrollIndicator: false,
      }
    : {};

  const barStyle =
    statusBarStyle === "auto"
      ? theme.mode === "dark"
        ? "light-content"
        : "dark-content"
      : statusBarStyle === "light"
      ? "light-content"
      : "dark-content";

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: background ?? theme.bg, paddingTop: insets.top },
      ]}
    >
      {!hideStatusBar ? (
        <StatusBar barStyle={barStyle} backgroundColor="transparent" translucent />
      ) : null}

      {showBack ? (
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.85 },
            ]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={theme.fg} />
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <Body
          {...bodyProps}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.body,
            // No bottom CTA reserve when a footer is mounted — the
            // footer itself takes that space and the body can flow up
            // to it. With no footer we leave a small gap so content
            // doesn't kiss the help row.
            { paddingBottom: footer ? theme.space.s4 : theme.space.s5 },
            contentStyle,
          ]}
        >
          {children}
        </Body>
        {footer ? (
          <View style={styles.footerRow}>{footer}</View>
        ) : null}
        {showHelp ? (
          <View style={[styles.helpRow, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.helpLeading}>Need help? </Text>
            <Pressable
              onPress={handleHelp}
              accessibilityRole="link"
              accessibilityLabel="Contact support"
            >
              <Text style={styles.helpLink}>Contact support</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      paddingHorizontal: theme.space.s5,
      gap: theme.space.s3,
    },
    footerRow: {
      paddingHorizontal: theme.space.s5,
      paddingTop: theme.space.s3,
      paddingBottom: theme.space.s2,
    },
    helpRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingTop: theme.space.s3,
    },
    helpLeading: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    helpLink: {
      ...theme.type.bodySm,
      color: theme.primary,
      fontWeight: "700",
    },
  });
