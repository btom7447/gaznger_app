import React, { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
  Pressable,
  StyleSheet,
  StatusBar,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const onboardingSlides = [
  {
    key: "slide-1",
    image: require("@/assets/images/onboarding/onboarding-one.png"),
    title: "Fuel at your fingertips",
    description: "Skip the station, order fuel from your phone",
  },
  {
    key: "slide-2",
    image: require("@/assets/images/onboarding/onboarding-two.png"),
    title: "Fast Trusted Delivery",
    description: "Verified riders deliver your fuel with care",
  },
  {
    key: "slide-3",
    image: require("@/assets/images/onboarding/onboarding-three.png"),
    title: "You're In Control!",
    description: "Follow orders and make secure payments easily",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const flatListRef = useRef<FlatList<any> | null>(null);

  const onMomentumScrollEnd = (ev: any) => {
    const offsetX = ev.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(newIndex);
  };

  const goToLogin = () =>
    router.push({
      pathname: "/(auth)/authentication",
      params: { mode: "login" },
    });
  const goToSignUp = () =>
    router.push({
      pathname: "/(auth)/authentication",
      params: { mode: "signup" },
    });
  const openTerms = () => router.push("/(legal)/terms");
  const openPrivacy = () => router.push("/(legal)/privacy");

  const handleNext = () => {
    if (currentIndex < onboardingSlides.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }
  };

  const renderItem = ({
    item,
  }: {
    item: (typeof onboardingSlides)[number];
    index: number;
  }) => (
    <View style={styles(theme).slideWrapper}>
      <View style={styles(theme).slideContent}>
        <Text style={styles(theme).title}>{item.title}</Text>
        <Text style={styles(theme).description}>{item.description}</Text>

        <Image
          source={item.image}
          style={styles(theme).image}
          resizeMode="contain"
        />

        <View style={styles(theme).pagination}>
          {onboardingSlides.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[
                styles(theme).dot,
                i === currentIndex
                  ? styles(theme).dotActive
                  : styles(theme).dotInactive,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles(theme).container}>
      <StatusBar
        barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
      />

      <FlatList
        ref={flatListRef}
        data={onboardingSlides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ flexGrow: 1 }}
      />

      {currentIndex === onboardingSlides.length - 1 ? (
        <View style={styles(theme).bottomArea}>
          <Pressable style={styles(theme).primaryButton} onPress={goToLogin}>
            <Text style={styles(theme).primaryButtonText}>Log In</Text>
          </Pressable>
          <Pressable style={styles(theme).secondaryButton} onPress={goToSignUp}>
            <Text style={styles(theme).secondaryButtonText}>Sign Up</Text>
          </Pressable>
          <Text style={styles(theme).termsText}>
            By continuing you agree to{" "}
            <Text style={styles(theme).termsLink} onPress={openTerms}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={styles(theme).termsLink} onPress={openPrivacy}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      ) : (
        <View style={styles(theme).nextRow}>
          <View style={{ flex: 1 }} />
          <Pressable style={styles(theme).nextButton} onPress={handleNext}>
            <Ionicons
              name="chevron-forward-outline"
              size={20}
              color={theme.quinest}
              style={styles(theme).nextIcon}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, flexDirection: "column", justifyContent: "center", alignItems: "center" },
    slideWrapper: {
      width: SCREEN_WIDTH,
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 150,
      justifyContent: "flex-start",
    },
    slideContent: {
      alignItems: "center",
    },
    image: {
      width: "100%",
      height: undefined,
      aspectRatio: 1.5,
      marginTop: 30,
    },
    title: {
      fontWeight: "700",
      fontSize: 25,
      textAlign: "center",
      color: theme.text,
      marginBottom: 5,
    },
    description: {
      fontSize: 16,
      textAlign: "center",
      color: theme.text,
      lineHeight: 22,
      paddingHorizontal: 8,
    },
    pagination: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 20,
    },
    dot: { height: 5, borderRadius: 8, marginHorizontal: 3 },
    dotActive: {
      backgroundColor: theme.text,
      width: 50,
      borderRadius: 10,
    },
    dotInactive: { width: 5, backgroundColor: theme.text + "80" },
    bottomArea: {
      width: "100%",
      paddingHorizontal: 20,
      paddingBottom: 20,
      height: "30%",
    },
    nextRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingHorizontal: 20,
      paddingVertical: 40,
    },
    nextButton: {
      backgroundColor: theme.quaternary,
      padding: 10,
      width: 50,
      height: 50,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 10,
    },
    nextIcon: {
      fontSize: 30,
    },
    primaryButton: {
      width: "100%",
      backgroundColor: theme.quaternary,
      paddingVertical: 17,
      borderRadius: 10,
      marginBottom: 20,
      alignItems: "center",
    },
    primaryButtonText: {
      color: theme.quinest,
      fontSize: 20,
      fontWeight: "600",
    },
    secondaryButton: {
      width: "100%",
      borderWidth: 1,
      backgroundColor: theme.tertiary,
      borderColor: theme.secondary,
      paddingVertical: 15,
      borderRadius: 10,
      marginBottom: 12,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: theme.secondary,
      fontSize: 20,
      fontWeight: "600",
    },
    termsText: {
      color: theme.ash,
      fontSize: 18,
      lineHeight: 22,
    },
    termsLink: {
      color: theme.error,
    },
  });
