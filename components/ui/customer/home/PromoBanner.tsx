import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Theme, useTheme } from "@/constants/theme";

const AUTO_SCROLL_MS = 4500;

interface Slide {
  id: string;
  pill: string;
  titleLine1: string;
  titleLine2?: string;
  subtitle: string;
  /** Background gradient/solid driven from theme. Pass either a theme key or null for default primary. */
  bgKind: "primary" | "dark" | "olive";
}

/**
 * The 3 slides preserved from the legacy promo carousel, restated in the
 * new direction's voice ("Gaznger does the work" pill, period-style copy).
 * Per design: no right-side icon — title gets the visual weight, decorative
 * circles fill the empty side.
 */
const SLIDES: Slide[] = [
  {
    id: "delivery",
    pill: "Gaznger does the work",
    titleLine1: "Skip the queue.",
    titleLine2: "We'll bring it.",
    subtitle: "Order in 30s · rider in ~12 min",
    bgKind: "primary",
  },
  {
    id: "rewards",
    pill: "Earn on every order",
    titleLine1: "Points that pay",
    titleLine2: "for fuel.",
    subtitle: "Redeem for real discounts",
    bgKind: "dark",
  },
  {
    id: "trusted",
    pill: "Verified stations only",
    titleLine1: "Licensed.",
    titleLine2: "Quality-checked.",
    subtitle: "Trusted partners near you",
    bgKind: "olive",
  },
];

interface PromoBannerProps {
  onSlidePress?: (slideId: string) => void;
}

export default function PromoBanner({ onSlidePress }: PromoBannerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Width is page width minus the screen's horizontal gutter (s4 each side).
  const width =
    Dimensions.get("window").width - theme.space.s4 * 2;

  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const dotAnims = useRef(
    SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;

  const animateDots = (next: number) => {
    dotAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i === next ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (activeRef.current + 1) % SLIDES.length;
      scrollRef.current?.scrollTo({ x: width * next, animated: true });
      activeRef.current = next;
      setActive(next);
      animateDots(next);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(interval);
  }, [width]);

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== activeRef.current && idx >= 0 && idx < SLIDES.length) {
      activeRef.current = idx;
      setActive(idx);
      animateDots(idx);
    }
  };

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="start"
      >
        {SLIDES.map((slide) => (
          <SlideCard
            key={slide.id}
            slide={slide}
            width={width}
            onPress={() => onSlidePress?.(slide.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const w = dotAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [6, 20],
          });
          const opacity = dotAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 1],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: w,
                  opacity,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function SlideCard({
  slide,
  width,
  onPress,
}: {
  slide: Slide;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const bg =
    slide.bgKind === "primary"
      ? theme.primary
      : slide.bgKind === "dark"
        ? theme.palette.green900
        : theme.palette.green700;

  return (
    <View
      style={[styles.card, { width, backgroundColor: bg }]}
      accessibilityRole="button"
      accessibilityLabel={`${slide.titleLine1} ${slide.titleLine2 ?? ""}. ${slide.subtitle}`}
      onTouchEnd={onPress}
    >
      <View style={[styles.circle, styles.circleA]} pointerEvents="none" />
      <View style={[styles.circle, styles.circleB]} pointerEvents="none" />

      <View style={styles.content}>
        <View style={styles.pill}>
          <Text style={styles.pillText} numberOfLines={1}>
            {slide.pill}
          </Text>
        </View>
        <Text style={styles.title}>
          {slide.titleLine1}
          {slide.titleLine2 ? `\n${slide.titleLine2}` : ""}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {slide.subtitle}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      height: 200,
      borderRadius: theme.radius.xl,
      overflow: "hidden",
      ...theme.elevation.card,
    },
    circle: {
      position: "absolute",
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 999,
    },
    circleA: {
      width: 240,
      height: 240,
      top: -80,
      right: -60,
    },
    circleB: {
      width: 150,
      height: 150,
      bottom: -50,
      right: 30,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.space.s5,
      paddingVertical: theme.space.s5,
      justifyContent: "space-between",
    },
    pill: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s3,
      paddingVertical: 4,
      marginBottom: theme.space.s4,
    },
    pillText: {
      ...theme.type.micro,
      color: "#fff",
      fontWeight: "700",
    },
    title: {
      ...theme.type.display,
      fontSize: 28,
      lineHeight: 32,
      color: "#fff",
      letterSpacing: -0.4,
    },
    subtitle: {
      ...theme.type.body,
      color: "rgba(255,255,255,0.82)",
      marginTop: theme.space.s2 + 2,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 5,
      marginTop: theme.space.s2 + 2,
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
  });
