import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

interface Props {
  text: string;
  /** Default shield-checkmark. Override for context-specific framing. */
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Inline trust micro-copy with green tint. Replaces a legal-wall page;
 * the design philosophy is contextual reassurance at the moment of
 * concern (e.g. on the phone screen: "We never share your number").
 */
export default function TrustStrip({
  text,
  icon = "shield-checkmark",
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <Ionicons
        name={icon}
        size={16}
        color={
          theme.mode === "dark"
            ? theme.palette.green300
            : theme.palette.green700
        }
      />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.space.s2,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
      borderRadius: theme.radius.md,
      backgroundColor:
        theme.mode === "dark"
          ? theme.palette.green900
          : theme.palette.green50,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark"
          ? theme.palette.green800
          : theme.palette.green100,
    },
    text: {
      ...theme.type.bodySm,
      color:
        theme.mode === "dark"
          ? theme.palette.green200
          : theme.palette.green700,
      fontWeight: "600",
      flex: 1,
      lineHeight: 18,
    },
  });
