import { useTheme } from "@/constants/theme";
import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  Image,
  Text,
  Pressable,
} from "react-native";
import AuthToggle from "@/components/ui/AuthToggle";
import LoginForm from "@/components/ui/LoginForm";
import SignupForm from "@/components/ui/SignupForm";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

export default function AuthScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ mode?: "login" | "signup" }>();
  const { mode } = params;

  const [currentMode, setCurrentMode] = useState<"login" | "signup">(
    mode ?? "login"
  );

  const translateX = useSharedValue(currentMode === "login" ? 0 : -width);

  useEffect(() => {
    if (mode && mode !== currentMode) {
      setCurrentMode(mode);
      translateX.value = withTiming(mode === "login" ? 0 : -width, {
        duration: 300,
      });
    }
  }, [mode]);

  useEffect(() => {
    translateX.value = withTiming(currentMode === "login" ? 0 : -width, {
      duration: 300,
    });
  }, [currentMode]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const providers = [
    {
      id: "facebook",
      icon: require("@/assets/icons/facebook.png"),
      show: true,
    },
    { id: "google", icon: require("@/assets/icons/google.png"), show: true },
    {
      id: "apple",
      icon: require("@/assets/icons/apple.png"),
      show: Platform.OS === "ios",
    },
  ];

  return (
    <View style={styles(theme).container}>
      <View style={styles(theme).screenHeader}>
        <AuthToggle mode={currentMode} setMode={setCurrentMode} />
      </View>

      <ScrollView
        style={styles(theme).scrollContainer}
        contentContainerStyle={{ alignItems: "center" }}
      >
        <Text style={styles(theme).title}>
          {currentMode === "login"
            ? "Welcome back!"
            : "Create an account"}
        </Text>

        <View style={styles(theme).formWrapper}>
          <Animated.View
            style={[styles(theme).animatedContainer, animatedStyle]}
          >
            <View style={styles(theme).formContainer}>
              <LoginForm />
            </View>
            <View style={styles(theme).formContainer}>
              <SignupForm />
            </View>
          </Animated.View>
        </View>

        <View style={styles(theme).continueContainer}>
          <Text style={styles(theme).subTitle}>or continue with</Text>
          <View style={styles(theme).authButtonsContainer}>
            {providers
              .filter((p) => p.show)
              .map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [
                    styles(theme).authButton,
                    {
                      borderColor: pressed ? theme.primary : theme.background,
                      backgroundColor: pressed
                        ? theme.secondary + "20"
                        : theme.background,
                    },
                  ]}
                >
                  <Image
                    source={p.icon}
                    style={styles(theme).buttonIcon}
                    resizeMode="contain"
                  />
                </Pressable>
              ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.background,
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 100,
      width: "100%",
    },
    screenHeader: { paddingVertical: 10 },
    scrollContainer: {},
    title: {
      fontWeight: "700",
      fontSize: 25,
      textAlign: "center",
      color: theme.text,
      marginBottom: 5,
      marginTop: 40,
    },
    subTitle: {
      fontWeight: "700",
      fontSize: 23,
      textAlign: "center",
      color: theme.text,
      marginVertical: 20,
    },
    formWrapper: { width: width, overflow: "hidden", marginTop: 30 },
    animatedContainer: { flexDirection: "row", width: width * 2 },
    formContainer: { width: width, paddingHorizontal: 20 },
    continueContainer: {
      width: "100%",
      flexDirection: "column",
      justifyContent: "center",
      marginTop: -60,
    },
    authButtonsContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 30,
    },
    authButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 20,
      borderWidth: 1,
      borderRadius: 50,
    },
    authButtonText: { fontSize: 16, fontWeight: "500", color: theme.text },
    buttonIcon: { width: 40, height: 40, objectFit: "contain", aspectRatio: 1.5 },
    termsText: { color: theme.error, fontSize: 18, textAlign: "center" },
    termsLink: { color: theme.primary },
  });
