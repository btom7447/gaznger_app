import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import { setHasOnboarded } from "@/lib/auth";
import OnboardIllo, { OnboardKind } from "@/components/ui/auth/OnboardIllo";
import { FloatingCTA, ProgressDots } from "@/components/ui/primitives";

interface Frame {
  kind: OnboardKind;
  title: string;
  body: string;
}

const FRAMES: Frame[] = [
  {
    kind: "logistics",
    title: "Fuel logistics, simplified.",
    body:
      "Whether you're ordering, riding, or running a station — Gaznger handles the queue, the routing, and the money.",
  },
  {
    kind: "trust",
    title: "Built on trust, end to end.",
    body:
      "NMDPRA-licensed stations. Verified riders. Transparent pricing. Every order gets a receipt, every transaction gets a record.",
  },
  {
    kind: "money",
    title: "Money moves cleanly.",
    body:
      "Pay or get paid through your wallet. Paystack secures every transaction. We never see your card details.",
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * 3-frame swipeable onboarding. Skip in the top-right; CTA flips to
 * "Get started" on the final frame. Tapping CTA on non-final frames
 * advances by one. Skip + final-frame CTA both flip the
 * `gaznger.has-onboarded` SecureStore flag and route to /welcome so
 * the user never sees onboarding again on this install.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = step === FRAMES.length - 1;
  const frame = FRAMES[step];

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (next !== step) setStep(next);
    },
    [step]
  );

  const finish = useCallback(async () => {
    await setHasOnboarded(true);
    router.replace("/(auth)/welcome" as never);
  }, [router]);

  const handleCta = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    const next = step + 1;
    setStep(next);
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
  }, [isLast, step, finish]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />

      {/* Skip — fixed top-right */}
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          hitSlop={12}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 0 }}
      >
        {FRAMES.map((f, i) => (
          <View
            key={f.kind}
            style={[styles.page, { width: SCREEN_WIDTH }]}
            accessibilityRole="text"
            accessibilityLabel={`${f.title}. ${f.body}`}
          >
            <OnboardIllo kind={f.kind} />
            <View style={styles.copyWrap}>
              <Text style={styles.title}>{f.title}</Text>
              <Text style={styles.body}>{f.body}</Text>
            </View>
            {/* spacer balances the CTA reserve below */}
            <View style={{ flex: 1 }} />
          </View>
        ))}
      </ScrollView>

      {/* Progress dots — sit just above the CTA reserve. ProgressDots
          `dots` variant grows the active dot wider, matching the design. */}
      <View style={styles.dotsRow}>
        <ProgressDots step={step} total={FRAMES.length} variant="dots" />
      </View>

      <FloatingCTA
        label={isLast ? "Get started" : "Continue"}
        onPress={handleCta}
        accessibilityLabel={
          isLast ? "Get started — finish onboarding" : "Continue to next frame"
        }
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    topRow: {
      paddingHorizontal: theme.space.s5,
      paddingVertical: theme.space.s2,
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    skip: {
      ...theme.type.body,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    scroll: {
      flex: 1,
    },
    page: {
      flex: 0,
      paddingHorizontal: 0,
    },
    copyWrap: {
      paddingHorizontal: theme.space.s5,
      paddingTop: theme.space.s5 + 8,
      gap: theme.space.s3,
    },
    title: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
    },
    body: {
      ...theme.type.body,
      color: theme.fgMuted,
      lineHeight: 22,
    },
    dotsRow: {
      paddingHorizontal: theme.space.s5,
      paddingBottom: theme.space.s4,
      alignItems: "center",
    },
  });
