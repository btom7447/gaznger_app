import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import Button from "./Button";

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  /** Primary CTA. */
  action?: { label: string; onPress: () => void };
  /** Compact variant — smaller tile, less padding. */
  compact?: boolean;
  /** Tile color. Default: theme.bgMuted. */
  tileBg?: string;
  /** Tile foreground (icon) color. Default: theme.fgMuted. */
  tileFg?: string;
  style?: ViewStyle;
}

/**
 * Consistent empty state across screens.
 */
export default function EmptyState({
  icon,
  title,
  body,
  action,
  compact = false,
  tileBg,
  tileFg,
  style,
}: EmptyStateProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tileSize = compact ? 56 : 64;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <View
        style={[
          styles.tile,
          {
            width: tileSize,
            height: tileSize,
            backgroundColor: tileBg ?? theme.bgMuted,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={compact ? 24 : 28}
          color={tileFg ?? theme.fgMuted}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? (
        <View style={styles.actionWrap}>
          <Button variant="primary" size="md" onPress={action.onPress}>
            {action.label}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.s5,
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s3,
    },
    wrapCompact: {
      paddingVertical: theme.space.s4,
      gap: theme.space.s2,
    },
    tile: {
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...theme.type.h2,
      color: theme.fg,
      textAlign: "center",
    },
    body: {
      ...theme.type.body,
      color: theme.fgMuted,
      textAlign: "center",
      maxWidth: 320,
    },
    actionWrap: {
      marginTop: theme.space.s2,
    },
  });
