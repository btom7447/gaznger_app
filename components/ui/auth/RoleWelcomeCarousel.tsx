import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import {
  ForestHeroBg,
  HeroArt,
  PageDots,
  authHeroTokens,
  type AuthHeroTokens,
} from "./AuthHero";

const SCREEN_W = Dimensions.get("window").width;

export interface RoleWelcomeSlide {
  illustration:
    | "vendor-1"
    | "vendor-2"
    | "vendor-3"
    | "rider-1"
    | "rider-2"
    | "rider-3";
  title: string;
  sub: string;
}

interface Props {
  /** Eyebrow rendered above every slide. e.g. "For vendors". */
  eyebrow: string;
  /** 3 pitch slides. */
  slides: RoleWelcomeSlide[];
  /** CTA slide title (e.g. "Ready to set up?"). */
  ctaTitle: string;
  /** CTA slide subtitle. */
  ctaSub: string;
  /** CTA button label (e.g. "Get started"). */
  ctaLabel: string;
  /** Tapped when user hits Get started. */
  onCta: () => void;
  /** Tapped when user hits back from slide 1. */
  onBack: () => void;
}

/**
 * Shared 4-slide carousel for the vendor + rider welcomes.
 *
 * Same forest-gradient + circles hero language as the cold-start
 * welcome.tsx — reuses `ForestHeroBg`, `HeroArt`, `PageDots`. Pre-CTA
 * slides have a Skip + Back; the CTA slide has only a Back link + the
 * single primary `Get started` button (no second CTA because the user
 * already chose Sign up).
 */
export default function RoleWelcomeCarousel({
  eyebrow,
  slides,
  ctaTitle,
  ctaSub,
  ctaLabel,
  onCta,
  onBack,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tokens = useMemo(() => authHeroTokens(theme), [theme]);
  const styles = useMemo(
    () => makeStyles(theme, insets.top, insets.bottom, tokens),
    [theme, insets.top, insets.bottom, tokens],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      setActiveIndex(idx);
    },
    [],
  );

  const handleSkip = useCallback(() => {
    listRef.current?.scrollToIndex({ index: 3, animated: true });
  }, []);

  const handleBack = useCallback(() => {
    if (activeIndex === 0) {
      onBack();
      return;
    }
    listRef.current?.scrollToIndex({
      index: Math.max(0, activeIndex - 1),
      animated: true,
    });
  }, [activeIndex, onBack]);

  const data = useMemo<(RoleWelcomeSlide | "cta")[]>(
    () => [...slides, "cta"],
    [slides],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: RoleWelcomeSlide | "cta"; index: number }) => {
      if (item === "cta") {
        return (
          <View style={{ width: SCREEN_W }}>
            <View style={styles.slide}>
              <ForestHeroBg theme={theme} />
              <View style={styles.headerRow}>
                <Pressable
                  onPress={handleBack}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.backBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.backInner}>
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={tokens.textPrimary}
                    />
                    <Text style={styles.backBtnText}>Back</Text>
                  </View>
                </Pressable>
                <View />
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                <Text
                  style={[styles.heroTitle, { marginTop: 8 }]}
                  accessibilityRole="header"
                >
                  {ctaTitle}
                </Text>
                <Text style={styles.heroSub}>{ctaSub}</Text>
              </View>
              <View style={styles.ctaFooter}>
                <Pressable
                  onPress={onCta}
                  accessibilityRole="button"
                  accessibilityLabel={ctaLabel}
                  style={({ pressed }) => [
                    styles.getStartedBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.getStartedText}>{ctaLabel}</Text>
                </Pressable>
                <PageDots
                  active={activeIndex}
                  total={4}
                  activeColor={tokens.dotActive}
                  inactiveColor={tokens.dotInactive}
                />
              </View>
            </View>
          </View>
        );
      }
      return (
        <View style={{ width: SCREEN_W }}>
          <View style={styles.slide}>
            <ForestHeroBg theme={theme} />
            <View style={styles.headerRow}>
              <Pressable
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={6}
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.backBtnText}>←  Back</Text>
              </Pressable>
              <Pressable
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip intro"
                hitSlop={6}
                style={({ pressed }) => [
                  styles.skipBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </View>
            <View style={styles.heroBody}>
              <HeroArt kind={item.illustration} theme={theme} />
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text
                style={[styles.heroTitle, { marginTop: 8 }]}
                accessibilityRole="header"
                accessibilityLabel={`${item.title}. ${item.sub}`}
              >
                {item.title}
              </Text>
              <Text style={styles.heroSub}>{item.sub}</Text>
            </View>
            <View style={styles.slideFooter}>
              <PageDots
                active={activeIndex}
                total={4}
                activeColor={tokens.dotActive}
                inactiveColor={tokens.dotInactive}
              />
            </View>
          </View>
        </View>
      );
    },
    [
      styles,
      theme,
      tokens,
      handleBack,
      handleSkip,
      onCta,
      eyebrow,
      ctaTitle,
      ctaSub,
      ctaLabel,
      activeIndex,
    ],
  );

  return (
    <View style={styles.root}>
      <StatusBar style={tokens.statusBar} />
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `role-slide-${i}`}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        bounces={false}
      />
    </View>
  );
}

const makeStyles = (
  theme: Theme,
  topInset: number,
  bottomInset: number,
  tokens: AuthHeroTokens,
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor:
        theme.mode === "dark" ? theme.palette.green800 : theme.bg,
    },
    slide: {
      width: SCREEN_W,
      flex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      minHeight: topInset + 44,
    },
    backBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    backInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    backBtnText: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: "700",
      opacity: 0.85,
    },
    skipBtn: {
      backgroundColor: tokens.skipBg,
      borderColor: tokens.skipBorder,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    skipText: {
      color: tokens.skipText,
      fontSize: 12,
      fontWeight: "700",
    },
    heroBody: {
      flex: 1,
      paddingHorizontal: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    eyebrow: {
      color: tokens.eyebrow,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    heroTitle: {
      color: tokens.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.4,
      lineHeight: 31,
      textAlign: "center",
    },
    heroSub: {
      color: tokens.textSecondary,
      fontSize: 14.5,
      lineHeight: 22,
      textAlign: "center",
      marginTop: 12,
      maxWidth: 280,
    },
    slideFooter: {
      paddingHorizontal: 24,
      paddingBottom: Math.max(bottomInset + 8, 32),
    },
    ctaFooter: {
      paddingHorizontal: 24,
      paddingBottom: Math.max(bottomInset + 8, 28),
      gap: 12,
    },
    getStartedBtn: {
      height: 52,
      borderRadius: 999,
      backgroundColor: tokens.primaryBtnBg,
      alignItems: "center",
      justifyContent: "center",
    },
    getStartedText: {
      color: tokens.primaryBtnText,
      fontSize: 15,
      fontWeight: "800",
    },
  });
