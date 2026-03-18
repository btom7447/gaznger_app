import React, { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  StatusBar,
  Pressable,
  ActivityIndicator,
} from "react-native";
import BackButton from "@/components/ui/global/BackButton";
import { router } from "expo-router";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { toast } from "sonner-native";
import FormField from "@/components/ui/auth/FormField";

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const emailStatus = !email
    ? "default"
    : /^\S+@\S+\.\S+$/.test(email)
    ? "success"
    : "error";

  const isButtonEnabled = emailStatus === "success" && !loading;

  const sendOtp = async () => {
    if (!isButtonEnabled) return;
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      router.push({
        pathname: "/(auth)/otp",
        params: { email, type: "reset" },
      });
    } catch (err: any) {
      toast.error("Failed to send OTP", { description: err.message });
    } finally {
      setLoading(false);
    }
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
          <Text style={[styles.description, { color: theme.text }]}>
            Enter your email address and we'll send you a code to reset your password.
          </Text>
        </View>

        <View style={styles.bottomArea}>
          <FormField
            title="Email"
            value={email}
            placeholder="johndoe@gmail.com"
            handleChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            status={emailStatus}
          />

          <Pressable
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.primary,
                opacity: isButtonEnabled ? 1 : 0.5,
                marginTop: 30,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
            onPress={sendOtp}
            disabled={!isButtonEnabled}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.primaryButtonText, { color: "#fff" }]}>
                Send OTP
              </Text>
            )}
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
  slideContent: { marginBottom: 30 },
  title: {
    fontWeight: "600",
    fontSize: 28,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  bottomArea: {
    paddingHorizontal: 4,
    paddingBottom: 20,
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
