import React from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  G,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { useTheme } from "@/constants/theme";

export type OnboardKind = "logistics" | "trust" | "money";

interface Props {
  kind: OnboardKind;
  height?: number;
}

/**
 * Schematic onboarding illustrations matching the design's
 * `OnboardIllo` SVG. Three variants:
 *   - logistics: pump → cylinder → bike
 *   - trust:     station / rider / home triad with shield
 *   - money:     wallet card + lock + incoming arrow
 *
 * Uses theme tokens for fg + accent so dark mode is automatic.
 */
export default function OnboardIllo({ kind, height = 240 }: Props) {
  const theme = useTheme();
  const fg = theme.primary;
  const muted =
    theme.mode === "dark" ? theme.palette.neutral700 : theme.palette.neutral200;
  const wash =
    theme.mode === "dark" ? theme.palette.green900 : theme.palette.green50;
  const accent =
    theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold500;
  const surface =
    theme.mode === "dark" ? theme.palette.neutral800 : "#ffffff";

  return (
    <View
      style={{
        width: "100%",
        height,
        backgroundColor: wash,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={240} height={200} viewBox="0 0 240 200">
        {kind === "logistics" && (
          <>
            <Rect x={20} y={80} width={50} height={80} rx={6} fill={surface} stroke={fg} strokeWidth={2} />
            <Rect x={28} y={92} width={34} height={22} rx={3} fill={fg} opacity={0.18} />
            <Rect x={32} y={96} width={26} height={14} rx={2} fill={fg} />
            <SvgText x={45} y={106} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">PETROL</SvgText>
            <Rect x={32} y={124} width={26} height={3} rx={1.5} fill={muted} />
            <Rect x={32} y={132} width={20} height={3} rx={1.5} fill={muted} />
            <Path d="M70 100 L 88 100 L 88 86" stroke={fg} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Circle cx={88} cy={84} r={3} fill={fg} />
            <Rect x={98} y={98} width={38} height={62} rx={6} fill={accent} opacity={0.18} />
            <Rect x={98} y={98} width={38} height={62} rx={6} fill="none" stroke={accent} strokeWidth={2} />
            <Rect x={110} y={86} width={14} height={14} rx={2} fill={accent} />
            <Rect x={105} y={116} width={24} height={3} rx={1} fill={accent} />
            <G x={150} y={110}>
              <Rect x={0} y={-22} width={34} height={22} rx={4} fill={fg} />
              <Rect x={6} y={-18} width={22} height={14} rx={2} fill="#fff" opacity={0.4} />
              <Circle cx={6} cy={14} r={11} fill={surface} stroke={fg} strokeWidth={2.5} />
              <Circle cx={34} cy={14} r={11} fill={surface} stroke={fg} strokeWidth={2.5} />
              <Path d="M 6 14 L 14 -2 L 28 -2 L 34 14" stroke={fg} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
            </G>
            <Path d="M 10 178 Q 120 170 230 178" stroke={fg} strokeWidth={1.5} strokeDasharray="4 4" fill="none" opacity={0.5} />
          </>
        )}

        {kind === "trust" && (
          <>
            <Path d="M 36 100 C 90 60, 150 140, 204 100" stroke={fg} strokeWidth={2} strokeDasharray="5 4" fill="none" />
            <Circle cx={36} cy={100} r={28} fill={surface} stroke={fg} strokeWidth={2} />
            <Rect x={24} y={92} width={24} height={16} rx={2} fill={fg} />
            <Rect x={28} y={96} width={6} height={8} fill="#fff" />
            <Circle cx={120} cy={100} r={28} fill={surface} stroke={fg} strokeWidth={2} />
            <Circle cx={113} cy={106} r={5} fill="none" stroke={fg} strokeWidth={2} />
            <Circle cx={127} cy={106} r={5} fill="none" stroke={fg} strokeWidth={2} />
            <Path d="M 113 106 L 117 95 L 124 95 L 127 106" stroke={fg} strokeWidth={2} fill="none" />
            <Circle cx={204} cy={100} r={28} fill={surface} stroke={fg} strokeWidth={2} />
            <Path d="M 192 102 L 204 90 L 216 102 L 216 112 L 192 112 z" fill={fg} />
            <Rect x={200} y={104} width={8} height={8} fill="#fff" />
            <G x={120} y={30}>
              <Path
                d="M 0 -14 L 14 -8 L 14 4 C 14 12 0 20 0 20 C 0 20 -14 12 -14 4 L -14 -8 z"
                fill={fg}
              />
              <Path
                d="M -5 0 L -1 4 L 6 -3"
                stroke="#fff"
                strokeWidth={2.4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
            <SvgText x={36} y={148} textAnchor="middle" fontSize="9" fontWeight="800" fill={theme.fgMuted}>STATION</SvgText>
            <SvgText x={120} y={148} textAnchor="middle" fontSize="9" fontWeight="800" fill={theme.fgMuted}>RIDER</SvgText>
            <SvgText x={204} y={148} textAnchor="middle" fontSize="9" fontWeight="800" fill={theme.fgMuted}>YOU</SvgText>
          </>
        )}

        {kind === "money" && (
          <>
            <Rect x={40} y={60} width={160} height={90} rx={12} fill={fg} />
            <Rect x={52} y={72} width={40} height={6} rx={3} fill="#fff" opacity={0.6} />
            <Rect x={52} y={84} width={80} height={10} rx={2} fill="#fff" />
            <Rect x={52} y={100} width={60} height={6} rx={3} fill="#fff" opacity={0.5} />
            <Circle cx={178} cy={120} r={14} fill={accent} />
            <SvgText x={178} y={126} textAnchor="middle" fontSize="14" fontWeight="800" fill={theme.palette.neutral900}>₦</SvgText>
            <G x={40} y={168}>
              <Rect x={0} y={6} width={22} height={16} rx={3} fill={fg} />
              <Path d="M 4 6 L 4 2 a 7 7 0 0 1 14 0 L 18 6" stroke={fg} strokeWidth={2.5} fill="none" />
              <Circle cx={11} cy={14} r={2} fill="#fff" />
            </G>
            <SvgText x={76} y={184} fontSize="11" fontWeight="700" fill={theme.fgMuted}>SECURED · PAYSTACK</SvgText>
            <Path d="M 110 30 L 110 56" stroke={accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Path d="M 104 50 L 110 56 L 116 50" stroke={accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={110} cy={22} r={9} fill={accent} />
            <SvgText x={110} y={26} textAnchor="middle" fontSize="11" fontWeight="800" fill={theme.palette.neutral900}>+</SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}
