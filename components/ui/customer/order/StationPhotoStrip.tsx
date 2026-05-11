import React, { useMemo } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Photo strip for the station detail sheet.
 *
 * Real Cloudinary URLs (Station.images) come first; if none are set
 * we fall back to a single SVG placeholder modelled on the rev3
 * design — a stylised forecourt with canopy + pumps + dusk sky. The
 * placeholder lies less than four-up Synthetic photos would: the user
 * sees one tile that's clearly stylised art, not four faked grabs.
 */

interface Props {
  images?: string[];
  /** Hero image height. Strip thumbnail height matches. */
  height?: number;
}

export default function StationPhotoStrip({ images, height = 128 }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const list = images?.filter(Boolean) ?? [];

  if (list.length === 0) {
    return (
      <View style={[styles.placeholderWrap, { height }]}>
        <PlaceholderArt />
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {list.map((src, i) => (
        <View
          key={`${src}-${i}`}
          style={[
            styles.tile,
            {
              width: i === 0 ? 188 : 120,
              height,
            },
          ]}
        >
          <Image
            source={{ uri: src }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </View>
      ))}
    </ScrollView>
  );
}

/** Stylised forecourt placeholder — dusk palette to match rev3. */
function PlaceholderArt() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFD8A8" />
          <Stop offset="100%" stopColor="#F39C5C" />
        </LinearGradient>
      </Defs>
      <Rect width="200" height="80" fill="url(#sky)" />
      <Circle cx="160" cy="28" r="10" fill="#FFB347" opacity="0.85" />
      <Rect y="80" width="200" height="40" fill="#2A1E18" />
      <Rect x="22" y="40" width="6" height="50" fill="#2A2A2A" />
      <Rect x="172" y="40" width="6" height="50" fill="#2A2A2A" />
      <Rect x="14" y="32" width="172" height="14" rx="2" fill="#1A7F4F" />
      <Rect x="14" y="32" width="172" height="3" fill="#fff" opacity="0.18" />
      <Rect x="50" y="62" width="14" height="28" rx="2" fill="#E5E5E5" />
      <Rect x="50" y="62" width="14" height="6" fill="#1A7F4F" opacity="0.85" />
      <Rect x="92" y="62" width="14" height="28" rx="2" fill="#E5E5E5" />
      <Rect x="92" y="62" width="14" height="6" fill="#1A7F4F" opacity="0.85" />
      <Rect x="134" y="62" width="14" height="28" rx="2" fill="#E5E5E5" />
      <Rect x="134" y="62" width="14" height="6" fill="#1A7F4F" opacity="0.85" />
    </Svg>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollContent: {
      gap: 6,
      paddingRight: 16,
    },
    tile: {
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: theme.bgMuted,
    },
    placeholderWrap: {
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: theme.bgMuted,
    },
  });
