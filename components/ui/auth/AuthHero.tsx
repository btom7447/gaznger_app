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

export function ForestHeroBg({ theme }: { theme: Theme }) {
  return (
    <>
      <LinearGradient
        colors={[theme.palette.green700, theme.palette.green900, "#08231a"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        locations={[0, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.circlesTR}>
        <Svg width={320} height={320} viewBox="0 0 320 320">
          {[180, 142, 108, 76, 48].map((r) => (
            <Circle
              key={r}
              cx={160}
              cy={160}
              r={r}
              stroke="#fff"
              strokeWidth={1.1}
              fill="none"
              opacity={1 - r / 240}
            />
          ))}
        </Svg>
      </View>
      <View pointerEvents="none" style={styles.circlesBL}>
        <Svg width={260} height={260} viewBox="0 0 260 260">
          {[120, 92, 66, 42].map((r) => (
            <Circle
              key={r}
              cx={130}
              cy={130}
              r={r}
              stroke="#fff"
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
export function HeroArt({ kind }: { kind: HeroArtKind }) {
  const tint = "rgba(255,255,255,0.14)";
  const accent = "rgba(255,255,255,0.55)";
  const stroke = "#fff";
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
            fill="rgba(255,255,255,0.22)"
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
          <Circle cx={110} cy={86} r={9} fill="rgba(255,255,255,0.28)" />
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
          <Circle cx={80} cy={92} r={4} fill="#fff" stroke="none" />
          <Circle cx={138} cy={72} r={4} fill="#fff" stroke="none" />
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
}: {
  active: number;
  total: number;
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
            backgroundColor:
              i === active ? "#fff" : "rgba(255,255,255,0.32)",
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
    opacity: 0.32,
  },
  circlesBL: {
    position: "absolute",
    left: -110,
    bottom: -120,
    opacity: 0.14,
  },
});
