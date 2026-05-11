import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/constants/theme";

interface Props {
  size?: number;
}

/**
 * "gaznger." text mark with green dot. Used on Splash + Welcome.
 * Letter-spacing matches the design (-1.1).
 */
export default function Wordmark({ size = 28 }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <Text
        style={{
          fontSize: size,
          fontWeight: "800",
          letterSpacing: -1.1,
          color: theme.fg,
        }}
      >
        gaznger
      </Text>
      <Text
        style={{
          fontSize: size,
          fontWeight: "800",
          letterSpacing: -1.1,
          color:
            theme.mode === "dark" ? theme.palette.green400 : theme.primary,
        }}
      >
        .
      </Text>
    </View>
  );
}
