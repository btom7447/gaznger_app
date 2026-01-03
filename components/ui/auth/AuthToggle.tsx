"use client";

import React, { useEffect } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/constants/theme";

type AuthToggleProps = {
  mode: "login" | "signup";
  setMode: (mode: "login" | "signup") => void;
};

export default function AuthToggle({ mode, setMode }: AuthToggleProps) {
  const theme = useTheme();
  const active = useSharedValue(mode);

  useEffect(() => {
    active.value = mode; // sync animation if mode changes externally
  }, [mode]);

  const handleSwitch = (option: "login" | "signup") => {
    active.value = option;
    setMode(option);
  };

  const sliderStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(active.value === "login" ? 0 : 110, {
          duration: 250,
        }),
      },
    ],
  }));

  return (
    <View style={styles(theme).container}>
      <Animated.View style={[styles(theme).slider, sliderStyle]} />
      {["login", "signup"].map((opt) => (
        <Pressable
          key={opt}
          onPress={() => handleSwitch(opt as "login" | "signup")}
          style={styles(theme).option}
        >
          <Text
            style={[
              styles(theme).text,
              {
                color: mode === opt ? "#000" : theme.quinest,
                fontWeight: mode === opt ? "700" : "500",
              },
            ]}
          >
            {opt === "login" ? "Log In" : "Sign Up"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      width: 225,
      height: 50,
      backgroundColor: theme.quaternary,
      borderRadius: 17,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      position: "relative",
    },
    slider: {
      position: "absolute",
      width: 110,
      height: 45,
      backgroundColor: theme.quinest,
      borderRadius: 15,
      top: 2.5,
      left: 2.5,
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    option: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    text: {
      fontSize: 18,
      fontWeight: "600",
    },
  });
