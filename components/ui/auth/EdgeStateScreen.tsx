import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import { Button } from "@/components/ui/primitives";

export type EdgeTone = "error" | "neutral" | "warning" | "primary";

interface PrimaryCTA {
  label: string;
  onPress: () => void;
  /** Override the button variant — defaults follow tone. */
  variant?: "primary" | "destructive" | "outline";
  loading?: boolean;
}

interface SecondaryLink {
  /** Two-part link: leading neutral text + tappable green text. */
  leading?: string;
  link: string;
  onPress: () => void;
}

interface Props {
  /** Hero icon. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Tone tints the hero ring + reason block. */
  tone: EdgeTone;
  /** Big headline (24pt). */
  headline: string;
  /** Body copy (14pt fgMuted). */
  body: string;
  /** Optional block beneath the body — usually a labelled reason or
   *  status row (e.g. "Reason: …", "Expected back by 4:30 PM WAT"). */
  reason?: { label?: string; text: string };
  primaryCta: PrimaryCTA;
  secondary?: SecondaryLink;
}

/**
 * Shared frame for full-page edge-state screens (suspended, deleted,
 * maintenance, force-update, withdrawal-hold, new-device). Same
 * structural template across all variants — hero icon, copy, optional
 * reason/context block, primary CTA, optional secondary link. Per-tone
 * colour map is centralised so screens stay token-pure without each
 * having to compose its own palette block.
 */
export default function EdgeStateScreen({
  icon,
  tone,
  headline,
  body,
  reason,
  primaryCta,
  secondary,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const toneMap: Record<
    EdgeTone,
    { bg: string; fg: string; reasonBg: string; reasonBorder: string; reasonFg: string }
  > = {
    error: {
      bg: theme.errorTint,
      fg: theme.error,
      reasonBg: theme.errorTint,
      reasonBorder:
        theme.mode === "dark" ? theme.palette.error700 : theme.palette.error100,
      reasonFg:
        theme.mode === "dark" ? theme.palette.error100 : theme.palette.error700,
    },
    neutral: {
      bg: theme.bgMuted,
      fg: theme.fgMuted,
      reasonBg: theme.bgMuted,
      reasonBorder: theme.border,
      reasonFg: theme.fg,
    },
    warning: {
      bg: theme.warningTint,
      fg: theme.warning,
      reasonBg: theme.warningTint,
      reasonBorder:
        theme.mode === "dark" ? theme.palette.warning100 : theme.palette.warning100,
      reasonFg:
        theme.mode === "dark" ? theme.palette.warning100 : theme.palette.warning700,
    },
    primary: {
      bg: theme.primaryTint,
      fg: theme.primary,
      reasonBg: theme.bgMuted,
      reasonBorder: theme.border,
      reasonFg: theme.fg,
    },
  };
  const tones = toneMap[tone];

  // Default button variant per tone — error → destructive, else primary.
  const buttonVariant: PrimaryCTA["variant"] =
    primaryCta.variant ?? (tone === "error" ? "destructive" : "primary");

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + theme.space.s5,
          paddingBottom: insets.bottom + theme.space.s4,
        },
      ]}
    >
      <View style={styles.body}>
        <View style={[styles.iconRing, { backgroundColor: tones.bg }]}>
          <Ionicons name={icon} size={40} color={tones.fg} />
        </View>
        <View style={styles.copyWrap}>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.bodyText}>{body}</Text>
        </View>
        {reason ? (
          <View
            style={[
              styles.reasonBlock,
              { backgroundColor: tones.reasonBg, borderColor: tones.reasonBorder },
            ]}
          >
            {reason.label ? (
              <Text style={[styles.reasonLabel, { color: tones.fg }]}>
                {reason.label.toUpperCase()}
              </Text>
            ) : null}
            <Text style={[styles.reasonText, { color: tones.reasonFg }]}>
              {reason.text}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          variant={buttonVariant}
          size="lg"
          full
          onPress={primaryCta.onPress}
          loading={primaryCta.loading}
          accessibilityLabel={primaryCta.label}
        >
          {primaryCta.label}
        </Button>
        {secondary ? (
          <View style={styles.secondaryRow}>
            {secondary.leading ? (
              <Text style={styles.secondaryLeading}>{secondary.leading}</Text>
            ) : null}
            <Pressable
              onPress={secondary.onPress}
              accessibilityRole="link"
              accessibilityLabel={secondary.link}
              hitSlop={8}
            >
              <Text style={styles.secondaryLink}>{secondary.link}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: theme.space.s5,
    },
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.s5,
    },
    iconRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    copyWrap: {
      alignItems: "center",
      gap: theme.space.s2 + 2,
      paddingHorizontal: theme.space.s4,
    },
    headline: {
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "800",
      letterSpacing: -0.5,
      color: theme.fg,
      textAlign: "center",
    },
    bodyText: {
      ...theme.type.body,
      color: theme.fgMuted,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 320,
    },
    reasonBlock: {
      width: "100%",
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3 + 2,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      gap: 4,
    },
    reasonLabel: {
      ...theme.type.micro,
    },
    reasonText: {
      ...theme.type.bodySm,
      lineHeight: 20,
    },
    footer: {
      gap: theme.space.s2 + 2,
    },
    secondaryRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    secondaryLeading: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    secondaryLink: {
      ...theme.type.bodySm,
      color: theme.primary,
      fontWeight: "700",
    },
  });
