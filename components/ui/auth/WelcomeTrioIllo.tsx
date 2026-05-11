import React from "react";
import Svg, {
  Circle,
  G,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { useTheme } from "@/constants/theme";

interface Props {
  width?: number;
  height?: number;
}

/**
 * Welcome-gate trio illustration. You / Rider / Station nodes joined
 * by a dashed primary curve. Same pattern as the design's hero.
 */
export default function WelcomeTrioIllo({ width = 260, height = 180 }: Props) {
  const theme = useTheme();
  const fg = theme.primary;
  const wash =
    theme.mode === "dark" ? theme.palette.green900 : theme.palette.green50;

  return (
    <Svg width={width} height={height} viewBox="0 0 260 180" fill="none">
      <Path
        d="M 30 130 Q 130 50 230 130"
        stroke={fg}
        strokeWidth={2}
        strokeDasharray="4 4"
        fill="none"
        opacity={0.4}
      />
      <G x={30} y={130}>
        <Circle r={32} fill={wash} />
        <Path d="M -14 4 L 0 -10 L 14 4 L 14 14 L -14 14 z" fill={fg} />
        <Rect x={-5} y={2} width={10} height={12} fill={wash} />
        <SvgText y={44} textAnchor="middle" fontSize="9" fontWeight="800" fill={theme.fgMuted}>
          YOU
        </SvgText>
      </G>
      <G x={130} y={80}>
        <Circle r={36} fill={wash} />
        <Circle cx={-10} cy={8} r={7} fill="none" stroke={fg} strokeWidth={2.4} />
        <Circle cx={10} cy={8} r={7} fill="none" stroke={fg} strokeWidth={2.4} />
        <Path
          d="M -10 8 L -3 -6 L 7 -6 L 10 8"
          stroke={fg}
          strokeWidth={2.4}
          fill="none"
          strokeLinejoin="round"
        />
        <Rect x={-2} y={-14} width={10} height={6} rx={1} fill={fg} />
        <SvgText y={56} textAnchor="middle" fontSize="9" fontWeight="800" fill={theme.fgMuted}>
          RIDER
        </SvgText>
      </G>
      <G x={230} y={130}>
        <Circle r={32} fill={wash} />
        <Rect x={-12} y={-8} width={20} height={22} rx={2} fill={fg} />
        <Rect x={-8} y={-4} width={6} height={6} fill={wash} />
        <Rect x={-8} y={6} width={6} height={6} fill={wash} />
        <Path d="M 8 -4 L 14 -4 L 14 14" stroke={fg} strokeWidth={2} fill="none" />
        <SvgText y={44} textAnchor="middle" fontSize="9" fontWeight="800" fill={theme.fgMuted}>
          STATION
        </SvgText>
      </G>
    </Svg>
  );
}
