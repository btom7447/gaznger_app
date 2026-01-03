import React, { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  StatusBar,
  Image,
  Pressable,
} from "react-native";
import BackButton from "@/components/ui/global/BackButton";
import AuthOptionButton from "@/components/ui/auth/AuthOptionButton";
import { router } from "expo-router";

import { maskEmail, maskPhone } from "@/utils/mask";
import { useTheme } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [selected, setSelected] = useState<"sms" | "email" | null>(null);

  const user = {
    name: "Benjamin Tom",
    email: "benjamintom7447@gmail.com",
    phone: "+2349155674236",
  };

  const otpTrigger = () => {
    if (!selected) return;
    router.push(
      `/(auth)/otp?method=${selected}&email=${encodeURIComponent(
        user.email
      )}&phone=${encodeURIComponent(user.phone)}`
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
      />

      <View style={styles.screenHeader}>
        <BackButton />
        <Text style={[styles.title, { color: theme.text }]}>
          Forgot Password
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.slideContent}>
          <Text style={[styles.description, { color: theme.error }]}>
            Select which contact detail to reset your password
          </Text>
        </View>

        <View style={styles.bottomArea}>
          <View style={styles.optionsContainer}>
            <AuthOptionButton
              type="sms"
              maskedValue={maskPhone(user.phone)}
              selected={selected === "sms"}
              onPress={() => setSelected("sms")}
            />
            <AuthOptionButton
              type="email"
              maskedValue={maskEmail(user.email)}
              selected={selected === "email"}
              onPress={() => setSelected("email")}
            />
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.primary,
                opacity: selected ? 1 : 0.5,
              },
            ]}
            onPress={otpTrigger}
            disabled={!selected}
          >
            <Text style={[styles.primaryButtonText, { color: "#fff" }]}>
              Continue
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenHeader: {
    paddingTop: 80,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 30,
  },
  scrollView: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  slideContent: { alignItems: "center", marginBottom: 20 },
  imageWrapper: { height: 300 },
  image: { width: "100%", height: "100%", aspectRatio: 1.2 },
  title: {
    fontWeight: "600",
    fontSize: 28,
    marginBottom: 12,
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  optionsContainer: {
    width: "100%",
    marginBottom: 30,
    gap: 20,
  },
  bottomArea: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    minHeight: "30%",
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 10,
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: "600",
  },
});
