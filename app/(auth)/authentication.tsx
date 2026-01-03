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
import AuthToggle from "@/components/ui/auth/AuthToggle";
import LoginForm from "@/components/ui/auth/LoginForm";
import SignupForm from "@/components/ui/auth/SignupForm";
import { useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { FontAwesome, Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function AuthScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ mode?: "login" | "signup" }>();
  const { mode } = params;

  const [currentMode, setCurrentMode] = useState<"login" | "signup">(
    mode ?? "login"
  );

  /** slide animation */
  const translateX = useSharedValue(currentMode === "login" ? 0 : -width);

  /** dynamic height handling */
  const [loginHeight, setLoginHeight] = useState(0);
  const [signupHeight, setSignupHeight] = useState(0);
  const formHeight = useSharedValue(0);

  /* sync route param */
  useEffect(() => {
    if (mode && mode !== currentMode) {
      setCurrentMode(mode);
    }
  }, [mode]);

  /* horizontal slide */
  useEffect(() => {
    translateX.value = withTiming(currentMode === "login" ? 0 : -width, {
      duration: 300,
    });
  }, [currentMode]);

  /* height animation */
  useEffect(() => {
    const targetHeight = currentMode === "login" ? loginHeight : signupHeight;

    if (targetHeight > 0) {
      formHeight.value = withTiming(targetHeight, { duration: 250 });
    }
  }, [currentMode, loginHeight, signupHeight]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const heightStyle = useAnimatedStyle(() => ({
    height: formHeight.value || undefined,
  }));

  const providers = [
    {
      id: "facebook",
      IconComponent: FontAwesome,
      name: "facebook-f",
      color: "#1877F2",
      show: true,
    },
    {
      id: "google",
      IconComponent: FontAwesome,
      name: "google",
      color: "#DB4437",
      show: true,
    },
    {
      id: "apple",
      IconComponent: Ionicons,
      name: "logo-apple",
      color: theme.text, // black or white depending on theme
      show: Platform.OS === "ios",
    },
  ];

  return (
    <View style={styles(theme).container}>
      <View style={styles(theme).screenHeader}>
        <AuthToggle mode={currentMode} setMode={setCurrentMode} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center" }}
      >
        <Text style={styles(theme).title}>
          {currentMode === "login" ? "Welcome back!" : "Create an account"}
        </Text>

        {/* FORM AREA */}
        <Animated.View style={[styles(theme).formWrapper, heightStyle]}>
          <Animated.View style={[styles(theme).animatedContainer, slideStyle]}>
            {/* LOGIN */}
            <View
              style={styles(theme).formContainer}
              onLayout={(e) => setLoginHeight(e.nativeEvent.layout.height)}
            >
              <LoginForm />
            </View>

            {/* SIGNUP */}
            <View
              style={styles(theme).formContainer}
              onLayout={(e) => setSignupHeight(e.nativeEvent.layout.height)}
            >
              <SignupForm />
            </View>
          </Animated.View>
        </Animated.View>

        {/* CONTINUE WITH */}
        <View style={styles(theme).continueContainer}>
          <Text style={styles(theme).subTitle}>or continue with</Text>
          <View style={styles(theme).authButtonsContainer}>
            {providers
              .filter((p) => p.show)
              .map((p) => {
                const Icon = p.IconComponent;
                return (
                  <Pressable
                    key={p.id}
                    style={({ pressed }) => [
                      styles(theme).authButton,
                      {
                        backgroundColor: pressed
                          ? theme.secondary + "20"
                          : theme.background,
                      },
                    ]}
                  >
                    <Icon name={p.name as any} size={25} color={p.color} />
                  </Pressable>
                );
              })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: "center",
      paddingTop: 100,
    },

    screenHeader: {
      paddingVertical: 10,
    },

    title: {
      fontSize: 25,
      fontWeight: "700",
      color: theme.text,
      marginTop: 40,
      marginBottom: 10,
      textAlign: "center",
    },

    subTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginVertical: 20,
      textAlign: "center",
    },

    formWrapper: {
      width,
      overflow: "hidden",
      marginTop: 20,
    },

    animatedContainer: {
      flexDirection: "row",
      width: width * 2,
    },

    formContainer: {
      width,
      paddingHorizontal: 20,
    },

    continueContainer: {
      width: "100%",
      marginTop: 30,
      alignItems: "center",
    },

    authButtonsContainer: {
      flexDirection: "row",
      gap: 30,
    },

    authButton: {
      padding: 20,
      borderRadius: 50,
      alignItems: "center",
      justifyContent: "center",
    },

    buttonIcon: {
      width: 30,
      height: 30,
      objectFit: "cover",
    },
  });
