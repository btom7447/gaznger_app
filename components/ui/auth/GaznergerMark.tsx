import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "@/constants/theme";

interface Props {
  size?: number;
  /** Override fill — defaults to theme.primary (or green400 in dark). */
  color?: string;
}

/**
 * Brand mark — droplet + forward chevron + dot. Mirrors the design's
 * `GaznergerMark` SVG. Token-pure: defaults to `theme.primary` in
 * light mode and `theme.palette.green400` in dark for the right
 * contrast against the dark background.
 */
export default function GaznergerMark({ size = 56, color }: Props) {
  const theme = useTheme();
  const fill =
    color ?? (theme.mode === "dark" ? theme.palette.green400 : theme.primary);
  const stroke = theme.fgOnPrimary;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path
        d="M32 6 C 32 6 14 24 14 38 a 18 18 0 0 0 36 0 C 50 24 32 6 32 6 z"
        fill={fill}
      />
      <Path
        d="M26 32 L 34 38 L 26 44"
        stroke={stroke}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={40} cy={38} r={2.4} fill={stroke} />
    </Svg>
  );
}
