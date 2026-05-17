import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import {
  ForestHeroBg,
  HeroArt,
  PageDots,
  authHeroTokens,
  type AuthHeroTokens,
} from "@/components/ui/auth/AuthHero";
import {
  clearBioCredential,
  getBioCredential,
  getDeviceLabel,
  getOrCreateDeviceId,
  hasBioCredential,
  markBioCredentialPresent,
  preparePinForTransmission,
  setBiometricEnabled,
} from "@/lib/auth";
import {
  biometricLabel,
  checkBiometricAvailability,
  type BiometricType,
} from "@/lib/permissions";
import { api } from "@/lib/api";
import { useSessionStore, type SessionUser } from "@/store/useSessionStore";
import { postAuthPathFor } from "@/lib/authRouting";

interface LoginResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Welcome — v7 unified auth entry.
 *
 * 4-slide carousel:
 *   slides 1–3  · customer-facing product pitch (every cold-start user)
 *   slide 4     · CTA fork — Sign in / Sign up (+ bio sign-in when device
 *                 has a stashed credential)
 *
 * Hero surface across all slides: forest gradient + concentric SVG arcs
 * top-right + (slides 1–3 only) a centered white-line spot illustration.
 * "Circles only" — no bolt or other decorations, per the global rule.
 *
 * Bio sign-in lives on slide 4 above the two CTAs when this device has
 * a stashed credential from a prior session.
 */

const SCREEN_W = Dimensions.get("window").width;

interface SlideConfig {
  illustration: SlotKind | null;
  title: string;
  sub: string;
}

type SlotKind = "customer-1" | "customer-2" | "customer-3";

const SLIDES: SlideConfig[] = [
  {
    illustration: "customer-1",
    title: "Fuel at your fingertips",
    sub: "Skip the station, order fuel from your phone.",
  },
  {
    illustration: "customer-2",
    title: "Fast, trusted delivery",
    sub: "Verified riders deliver your fuel with care.",
  },
  {
    illustration: "customer-3",
    title: "Secured payments",
    sub: "Pay with card, wallet, or transfer — every kobo Paystack-secured.",
  },
];

export default function WelcomeGate() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useMemo(() => authHeroTokens(theme), [theme]);
  const styles = useMemo(
    () => makeStyles(theme, insets.top, insets.bottom, tokens),
    [theme, insets.top, insets.bottom, tokens],
  );
  const sessionLogin = useSessionStore((s) => s.login);

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  // Bio sign-in surface — only renders on slide 4 when this device has
  // a stashed credential (user enabled biometric in Settings in a prior
  // session AND hasn't signed out / forgotten the device since).
  const [bioReady, setBioReady] = useState(false);
  const [bioType, setBioType] = useState<BiometricType>("none");
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [hasCred, avail] = await Promise.all([
        hasBioCredential(),
        checkBiometricAvailability(),
      ]);
      if (!alive) return;
      // Both must be true: a credential AND the device still has
      // biometric enrolled. If hardware/enrolment changed since the
      // credential was set, hide the button — the user will sign in
      // via phone+OTP and re-enable from Settings.
      setBioReady(hasCred && avail.available);
      setBioType(avail.type);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const goAfterLogin = useCallback(
    (user: SessionUser) => {
      router.replace(postAuthPathFor(user) as never);
    },
    [router],
  );

  const goBioLogin = useCallback(async () => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      const cred = await getBioCredential(
        `Sign in to Gaznger with ${biometricLabel(bioType)}`,
      );
      if (!cred) return;
      const deviceId = await getOrCreateDeviceId();
      const prepared = await preparePinForTransmission(cred.pin);
      const res = await api.post<LoginResponse>(
        "/auth/login",
        { phone: cred.phone, pin: prepared },
        {
          headers: {
            "X-Device-Id": deviceId,
            "X-Device-Label": getDeviceLabel(),
          },
        },
      );
      sessionLogin(res);
      goAfterLogin(res.user);
    } catch (err: any) {
      const msg = err?.message ?? "Couldn't sign in";
      if (
        msg.toLowerCase().includes("verification required") ||
        msg.toLowerCase().includes("wrong pin") ||
        msg.toLowerCase().includes("incorrect")
      ) {
        await clearBioCredential().catch(() => {});
        await markBioCredentialPresent(false).catch(() => {});
        await setBiometricEnabled(false).catch(() => {});
        setBioReady(false);
        toast.error("Biometric sign-in not accepted", {
          description: "Sign in with phone + OTP and re-enable from Settings.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setBioBusy(false);
    }
  }, [bioBusy, bioType, sessionLogin, goAfterLogin]);

  const handleSkip = useCallback(() => {
    listRef.current?.scrollToIndex({ index: 3, animated: true });
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      setActiveIndex(idx);
    },
    [],
  );

  const goSignup = useCallback(
    () => router.push("/(auth)/signup/role" as never),
    [router],
  );
  const goSignin = useCallback(
    () =>
      router.push({
        pathname: "/(auth)/phone" as never,
        params: { mode: "signin" },
      } as never),
    [router],
  );
  const goTerms = useCallback(
    () => router.push("/(legal)/terms" as never),
    [router],
  );
  const goPrivacy = useCallback(
    () => router.push("/(legal)/privacy" as never),
    [router],
  );

  const renderSlide = useCallback(
    ({ item, index }: { item: SlideConfig | "cta"; index: number }) => {
      if (item === "cta") {
        return (
          <View style={{ width: SCREEN_W }}>
            <CTASlide
              styles={styles}
              theme={theme}
              tokens={tokens}
              bioReady={bioReady}
              bioBusy={bioBusy}
              bioType={bioType}
              onBio={goBioLogin}
              onSignin={goSignin}
              onSignup={goSignup}
              onTerms={goTerms}
              onPrivacy={goPrivacy}
              activeIndex={activeIndex}
            />
          </View>
        );
      }
      return (
        <View style={{ width: SCREEN_W }}>
          <PitchSlide
            slide={item}
            index={index}
            activeIndex={activeIndex}
            onSkip={handleSkip}
            styles={styles}
            theme={theme}
            tokens={tokens}
          />
        </View>
      );
    },
    [
      styles,
      theme,
      tokens,
      bioReady,
      bioBusy,
      bioType,
      goBioLogin,
      goSignin,
      goSignup,
      goTerms,
      goPrivacy,
      activeIndex,
      handleSkip,
    ],
  );

  const data = useMemo<(SlideConfig | "cta")[]>(
    () => [...SLIDES, "cta"],
    [],
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
        keyExtractor={(_, i) => `slide-${i}`}
        renderItem={renderSlide}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        bounces={false}
      />
    </View>
  );
}

/* ─────────────── Slide components ─────────────── */

function PitchSlide({
  slide,
  index,
  activeIndex,
  onSkip,
  styles,
  theme,
  tokens,
}: {
  slide: SlideConfig;
  index: number;
  activeIndex: number;
  onSkip: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
  tokens: AuthHeroTokens;
}) {
  return (
    <View style={styles.slide}>
      <ForestHeroBg theme={theme} />
      <View style={styles.headerRow}>
        <View />
        <Pressable
          onPress={onSkip}
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
        {slide.illustration ? (
          <HeroArt kind={slide.illustration} theme={theme} />
        ) : null}
        <Text
          style={styles.heroTitle}
          accessibilityRole="header"
          accessibilityLabel={`${slide.title}. ${slide.sub}`}
        >
          {slide.title}
        </Text>
        <Text style={styles.heroSub}>{slide.sub}</Text>
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
  );
}

function CTASlide({
  styles,
  theme,
  tokens,
  bioReady,
  bioBusy,
  bioType,
  onBio,
  onSignin,
  onSignup,
  onTerms,
  onPrivacy,
  activeIndex,
}: {
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
  tokens: AuthHeroTokens;
  bioReady: boolean;
  bioBusy: boolean;
  bioType: BiometricType;
  onBio: () => void;
  onSignin: () => void;
  onSignup: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
  activeIndex: number;
}) {
  return (
    <View style={styles.slide}>
      <ForestHeroBg theme={theme} />
      <View style={styles.headerRow}>
        <View />
        <View />
      </View>
      <View style={styles.heroBody}>
        <Image
          source={tokens.logoAsset}
          style={styles.wordmarkLogo}
          resizeMode="contain"
          accessibilityLabel="Gaznger"
        />
        <Text
          style={styles.heroTitle}
          accessibilityRole="header"
        >
          Fuel, the easy way.
        </Text>
        <Text style={styles.heroSub}>
          Households, vendors, riders — one app for all.
        </Text>
      </View>
      <View style={styles.ctaFooter}>
        {bioReady ? (
          <Pressable
            onPress={onBio}
            disabled={bioBusy}
            accessibilityRole="button"
            accessibilityLabel={`Sign in with ${biometricLabel(bioType)}`}
            style={({ pressed }) => [
              styles.bioButton,
              (pressed || bioBusy) && { opacity: 0.85 },
            ]}
          >
            <Ionicons
              name="finger-print"
              size={20}
              color={tokens.bioBtnText}
            />
            <Text style={styles.bioButtonText}>
              Sign in with {biometricLabel(bioType)}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onSignin}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          style={({ pressed }) => [
            styles.signinBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.signinBtnText}>Sign in</Text>
        </Pressable>
        <Pressable
          onPress={onSignup}
          accessibilityRole="button"
          accessibilityLabel="Sign up"
          style={({ pressed }) => [
            styles.signupBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.signupBtnText}>Sign up</Text>
        </Pressable>
        <PageDots
          active={activeIndex}
          total={4}
          activeColor={tokens.dotActive}
          inactiveColor={tokens.dotInactive}
        />
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>By continuing you agree to our </Text>
          <Pressable onPress={onTerms} hitSlop={6}>
            <Text style={styles.legalLink}>Terms</Text>
          </Pressable>
          <Text style={styles.legalText}> and </Text>
          <Pressable onPress={onPrivacy} hitSlop={6}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalText}>.</Text>
        </View>
      </View>
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
      paddingHorizontal: 24,
      paddingTop: topInset + 8,
      minHeight: topInset + 44,
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
      gap: 10,
    },
    wordmarkLogo: {
      width: 200,
      height: 70,
      marginBottom: 24,
    },
    bioButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 52,
      borderRadius: 999,
      backgroundColor: tokens.bioBtnBg,
      borderWidth: 1,
      borderColor: tokens.bioBtnBorder,
    },
    bioButtonText: {
      color: tokens.bioBtnText,
      fontSize: 15,
      fontWeight: "800",
    },
    signinBtn: {
      height: 52,
      borderRadius: 999,
      backgroundColor: tokens.primaryBtnBg,
      alignItems: "center",
      justifyContent: "center",
    },
    signinBtnText: {
      color: tokens.primaryBtnText,
      fontSize: 15,
      fontWeight: "800",
    },
    signupBtn: {
      height: 52,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: tokens.outlineBtnBorder,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    signupBtnText: {
      color: tokens.outlineBtnText,
      fontSize: 15,
      fontWeight: "800",
    },
    legalRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 8,
      marginTop: 8,
    },
    legalText: {
      color: tokens.legalText,
      fontSize: 11.5,
      lineHeight: 18,
    },
    legalLink: {
      color: tokens.legalLink,
      fontSize: 11.5,
      fontWeight: "700",
      lineHeight: 18,
      textDecorationLine: "underline",
    },
  });
