import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";
import { Theme } from "@/constants/theme";

/**
 * Auth hero visuals — shared by every auth welcome surface (cold-start
 * customer welcome + vendor role welcome + rider role welcome).
 *
 * Owns: forest gradient background, concentric SVG arcs (top-right
 * dominant + subtle bottom-left), spot illustrations for each slide,
 * and the dot indicator.
 *
 * Lives under components/ui/auth/ instead of inside the route file so
 * the carousel components can import without crossing the route ↔
 * component boundary.
 */

/**
 * Theme-aware token bundle for every auth hero surface (welcome,
 * role welcomes, pending). Single source of truth so the gradient,
 * circle stroke, body text, eyebrow tint, and CTA colors all flip
 * together when the user toggles dark/light mode.
 *
 * Light mode: white bg, ash circles, near-black text, brand-green CTAs.
 * Dark mode:  forest gradient, white circles, white text, white CTAs.
 */
export interface AuthHeroTokens {
  /** Stops fed to LinearGradient. Light = 3 white stops, dark = forest. */
  gradient: [string, string, string];
  gradientLocations: [number, number, number];
  /** Circle stroke + base opacity for the top-right + bottom-left arcs. */
  circleStroke: string;
  circleTROpacity: number;
  circleBLOpacity: number;
  /** Body / heading text on the hero surface. */
  textPrimary: string;
  textSecondary: string;
  /** Eyebrow tint over the hero (uppercase caption). */
  eyebrow: string;
  /** Skip button bg + border + text. */
  skipBg: string;
  skipBorder: string;
  skipText: string;
  /** Status-bar style for the screen. */
  statusBar: "light" | "dark";
  /** Page dots. */
  dotActive: string;
  dotInactive: string;
  /** Sign in / Get started — the primary button. */
  primaryBtnBg: string;
  primaryBtnText: string;
  /** Sign up / outline secondary button. */
  outlineBtnBorder: string;
  outlineBtnText: string;
  /** Bio sign-in row (welcome-only, dark style). */
  bioBtnBg: string;
  bioBtnBorder: string;
  bioBtnText: string;
  /** Wordmark logo asset to use (gaznger-logo.png light vs gaznger_logo.png dark). */
  logoAsset: number;
  /** Legal-row text + link colors. */
  legalText: string;
  legalLink: string;
  /** Spot-illustration stroke / soft fill / accent dot. */
  artStroke: string;
  artTint: string;
  artAccent: string;
}

export function authHeroTokens(theme: Theme): AuthHeroTokens {
  if (theme.mode === "dark") {
    return {
      gradient: [theme.palette.green700, theme.palette.green900, "#08231a"],
      gradientLocations: [0, 0.65, 1],
      circleStroke: "#fff",
      circleTROpacity: 0.32,
      circleBLOpacity: 0.14,
      textPrimary: "#fff",
      textSecondary: "rgba(255,255,255,0.82)",
      eyebrow: "rgba(255,255,255,0.78)",
      skipBg: "rgba(255,255,255,0.10)",
      skipBorder: "rgba(255,255,255,0.18)",
      skipText: "#fff",
      statusBar: "light",
      dotActive: "#fff",
      dotInactive: "rgba(255,255,255,0.32)",
      primaryBtnBg: "#fff",
      primaryBtnText: theme.palette.green700,
      outlineBtnBorder: "rgba(255,255,255,0.55)",
      outlineBtnText: "#fff",
      bioBtnBg: "rgba(255,255,255,0.18)",
      bioBtnBorder: "rgba(255,255,255,0.32)",
      bioBtnText: "#fff",
      logoAsset: require("@/assets/images/gaznger_logo.png"),
      legalText: "rgba(255,255,255,0.65)",
      legalLink: "#fff",
      artStroke: "#fff",
      artTint: "rgba(255,255,255,0.14)",
      artAccent: "rgba(255,255,255,0.55)",
    };
  }
  // Light mode — white bg, ash circles, dark text, brand-green CTAs.
  return {
    gradient: ["#FFFFFF", "#F6F8F7", "#ECEFEE"],
    gradientLocations: [0, 0.65, 1],
    circleStroke: theme.palette.neutral300,
    circleTROpacity: 0.55,
    circleBLOpacity: 0.32,
    textPrimary: theme.palette.neutral900,
    textSecondary: theme.palette.neutral600,
    eyebrow: theme.palette.neutral600,
    skipBg: theme.palette.neutral100,
    skipBorder: theme.palette.neutral200,
    skipText: theme.palette.neutral700,
    statusBar: "dark",
    dotActive: theme.palette.green700,
    dotInactive: theme.palette.neutral300,
    primaryBtnBg: theme.palette.green500,
    primaryBtnText: "#fff",
    outlineBtnBorder: theme.palette.green500,
    outlineBtnText: theme.palette.green700,
    bioBtnBg: theme.palette.green50,
    bioBtnBorder: theme.palette.green100,
    bioBtnText: theme.palette.green700,
    logoAsset: require("@/assets/images/gaznger-logo.png"),
    legalText: theme.palette.neutral500,
    legalLink: theme.palette.green700,
    artStroke: theme.palette.green700,
    artTint: theme.palette.green50,
    artAccent: theme.palette.green500,
  };
}

export function ForestHeroBg({ theme }: { theme: Theme }) {
  const tokens = authHeroTokens(theme);
  return (
    <>
      <LinearGradient
        colors={tokens.gradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        locations={tokens.gradientLocations}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[styles.circlesTR, { opacity: tokens.circleTROpacity }]}
      >
        <Svg width={320} height={320} viewBox="0 0 320 320">
          {[180, 142, 108, 76, 48].map((r) => (
            <Circle
              key={r}
              cx={160}
              cy={160}
              r={r}
              stroke={tokens.circleStroke}
              strokeWidth={1.1}
              fill="none"
              opacity={1 - r / 240}
            />
          ))}
        </Svg>
      </View>
      <View
        pointerEvents="none"
        style={[styles.circlesBL, { opacity: tokens.circleBLOpacity }]}
      >
        <Svg width={260} height={260} viewBox="0 0 260 260">
          {[120, 92, 66, 42].map((r) => (
            <Circle
              key={r}
              cx={130}
              cy={130}
              r={r}
              stroke={tokens.circleStroke}
              strokeWidth={1}
              fill="none"
              opacity={0.5}
            />
          ))}
        </Svg>
      </View>
    </>
  );
}

export type HeroArtKind =
  | "customer-1"
  | "customer-2"
  | "customer-3"
  | "vendor-1"
  | "vendor-2"
  | "vendor-3"
  | "rider-1"
  | "rider-2"
  | "rider-3";

/**
 * Spot illustration. Style contract for every variant:
 *   - 200×200 viewBox, white 2px stroke, round caps + joins
 *   - fills use white at 0.14–0.28 opacity only (no gradients, no extra colors)
 *   - no glyphs / emoji / text
 */
export function HeroArt({
  kind,
  theme,
}: {
  kind: HeroArtKind;
  theme: Theme;
}) {
  const tokens = authHeroTokens(theme);
  const tint = tokens.artTint;
  const accent = tokens.artAccent;
  const stroke = tokens.artStroke;
  return (
    <Svg
      width={200}
      height={200}
      viewBox="0 0 200 200"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginBottom: 8 }}
    >
      {kind === "customer-1" && (
        <>
          <Rect x={62} y={34} width={76} height={132} rx={14} fill={tint} />
          <Rect x={62} y={34} width={76} height={132} rx={14} />
          <Line x1={86} y1={152} x2={114} y2={152} />
          <Path
            d="M100 64 C 84 86 80 100 80 112 a20 20 0 0 0 40 0 c 0 -12 -4 -26 -20 -48 z"
            fill={tint}
          />
          <Path d="M100 64 C 84 86 80 100 80 112 a20 20 0 0 0 40 0 c 0 -12 -4 -26 -20 -48 z" />
          <Circle cx={92} cy={104} r={3} fill={accent} stroke="none" />
        </>
      )}
      {kind === "customer-2" && (
        <>
          <Path
            d="M30 150 Q 70 110 110 130 T 180 90"
            strokeDasharray="3,6"
            opacity={0.7}
          />
          <Circle cx={70} cy={148} r={14} fill={tint} />
          <Circle cx={70} cy={148} r={14} />
          <Circle cx={138} cy={148} r={14} fill={tint} />
          <Circle cx={138} cy={148} r={14} />
          <Path d="M70 148 L 96 116 L 122 116 L 138 148" />
          <Path d="M96 116 L 96 96 L 110 96" />
          <Circle cx={110} cy={86} r={9} fill={tint} />
          <Circle cx={110} cy={86} r={9} />
          <Path
            d="M168 60 a10 10 0 0 0 -20 0 c 0 8 10 22 10 22 s 10 -14 10 -22z"
            fill={tint}
          />
          <Path d="M168 60 a10 10 0 0 0 -20 0 c 0 8 10 22 10 22 s 10 -14 10 -22z" />
          <Circle cx={158} cy={60} r={3} fill={accent} stroke="none" />
        </>
      )}
      {kind === "customer-3" && (
        <>
          <Path
            d="M100 32 L 156 50 L 156 102 C 156 140 130 162 100 172 C 70 162 44 140 44 102 L 44 50 Z"
            fill={tint}
          />
          <Path d="M100 32 L 156 50 L 156 102 C 156 140 130 162 100 172 C 70 162 44 140 44 102 L 44 50 Z" />
          <Path d="M76 102 L 94 120 L 128 80" strokeWidth={3} />
          <Circle cx={36} cy={36} r={2.5} fill={accent} stroke="none" />
          <Circle cx={170} cy={34} r={2} fill={accent} stroke="none" />
          <Circle cx={172} cy={160} r={2.5} fill={accent} stroke="none" />
        </>
      )}
      {kind === "vendor-1" && (
        <>
          <Path
            d="M60 60 a14 14 0 0 0 -28 0 c 0 12 14 30 14 30 s 14 -18 14 -30z"
            fill={tint}
          />
          <Path d="M60 60 a14 14 0 0 0 -28 0 c 0 12 14 30 14 30 s 14 -18 14 -30z" />
          <Circle cx={46} cy={60} r={4} />
          <Path
            d="M148 92 a14 14 0 0 0 -28 0 c 0 12 14 30 14 30 s 14 -18 14 -30z"
            fill={tint}
          />
          <Path d="M148 92 a14 14 0 0 0 -28 0 c 0 12 14 30 14 30 s 14 -18 14 -30z" />
          <Circle cx={134} cy={92} r={4} />
          <Path
            d="M96 140 a14 14 0 0 0 -28 0 c 0 12 14 30 14 30 s 14 -18 14 -30z"
            fill={tint}
          />
          <Path d="M96 140 a14 14 0 0 0 -28 0 c 0 12 14 30 14 30 s 14 -18 14 -30z" />
          <Circle cx={82} cy={140} r={4} />
          <Path
            d="M46 78 L 82 130 L 134 108"
            strokeDasharray="3,5"
            opacity={0.65}
          />
        </>
      )}
      {kind === "vendor-2" && (
        <>
          <Rect x={34} y={64} width={98} height={60} rx={8} fill={tint} />
          <Rect x={34} y={64} width={98} height={60} rx={8} />
          <Circle cx={83} cy={94} r={10} />
          <Line x1={48} y1={78} x2={56} y2={78} />
          <Line x1={110} y1={110} x2={118} y2={110} />
          <Path d="M138 100 L 168 100" strokeDasharray="2,4" />
          <Path d="M160 92 L 168 100 L 160 108" />
          <Rect x={118} y={124} width={56} height={40} rx={7} fill={tint} />
          <Rect x={118} y={124} width={56} height={40} rx={7} />
          <Circle cx={156} cy={144} r={3} fill={accent} stroke="none" />
        </>
      )}
      {kind === "vendor-3" && (
        <>
          <Circle cx={100} cy={56} r={14} fill={tint} />
          <Circle cx={100} cy={56} r={14} />
          <Path d="M76 100 c 4 -16 16 -22 24 -22 s 20 6 24 22" />
          <Circle cx={48} cy={120} r={11} fill={tint} />
          <Circle cx={48} cy={120} r={11} />
          <Path d="M30 156 c 3 -12 11 -18 18 -18 s 15 6 18 18" />
          <Circle cx={152} cy={120} r={11} fill={tint} />
          <Circle cx={152} cy={120} r={11} />
          <Path d="M134 156 c 3 -12 11 -18 18 -18 s 15 6 18 18" />
          <Path d="M88 70 L 58 110" strokeDasharray="3,5" opacity={0.6} />
          <Path d="M112 70 L 142 110" strokeDasharray="3,5" opacity={0.6} />
        </>
      )}
      {kind === "rider-1" && (
        <>
          <Rect x={34} y={38} width={132} height={92} rx={10} fill={tint} />
          <Rect x={34} y={38} width={132} height={92} rx={10} />
          <Path d="M48 116 Q 80 80 110 92 T 158 60" strokeWidth={2.4} />
          <Circle cx={80} cy={92} r={4} fill={accent} stroke="none" />
          <Circle cx={138} cy={72} r={4} fill={accent} stroke="none" />
          <Circle cx={72} cy={160} r={12} fill={tint} />
          <Circle cx={72} cy={160} r={12} />
          <Circle cx={138} cy={160} r={12} fill={tint} />
          <Circle cx={138} cy={160} r={12} />
          <Path d="M72 160 L 100 138 L 122 138 L 138 160" />
        </>
      )}
      {kind === "rider-2" && (
        <>
          <Ellipse cx={100} cy={146} rx={46} ry={14} fill={tint} />
          <Ellipse cx={100} cy={146} rx={46} ry={14} />
          <Path d="M54 146 L 54 124 a 46 14 0 0 0 92 0 L 146 146" />
          <Path d="M54 124 a 46 14 0 0 0 92 0" />
          <Path d="M54 104 a 46 14 0 0 1 92 0" />
          <Path d="M54 124 L 54 104" />
          <Path d="M146 124 L 146 104" />
          <Path
            d="M100 38 L 100 58 M 86 48 L 114 48 M 90 38 L 110 58 M 110 38 L 90 58"
            opacity={0.65}
          />
        </>
      )}
      {kind === "rider-3" && (
        <>
          <Circle cx={100} cy={40} r={11} fill={tint} />
          <Circle cx={100} cy={40} r={11} />
          <Line x1={100} y1={51} x2={100} y2={86} />
          <Path d="M100 86 L 60 130" />
          <Path d="M100 86 L 140 130" strokeDasharray="3,5" />
          <Rect x={40} y={130} width={40} height={40} rx={6} fill={tint} />
          <Rect x={40} y={130} width={40} height={40} rx={6} />
          <Line x1={48} y1={146} x2={72} y2={146} />
          <Line x1={48} y1={156} x2={72} y2={156} />
          <Circle cx={140} cy={148} r={18} fill={tint} />
          <Path d="M122 148 a18 18 0 0 1 36 0" />
          <Line x1={122} y1={148} x2={158} y2={148} />
        </>
      )}
    </Svg>
  );
}

export function PageDots({
  active,
  total,
  activeColor = "#fff",
  inactiveColor = "rgba(255,255,255,0.32)",
}: {
  active: number;
  total: number;
  activeColor?: string;
  inactiveColor?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        justifyContent: "center",
        marginTop: 12,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 22 : 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: i === active ? activeColor : inactiveColor,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circlesTR: {
    position: "absolute",
    right: -120,
    top: -110,
  },
  circlesBL: {
    position: "absolute",
    left: -110,
    bottom: -120,
  },
});
