import React, { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import BackButton from "@/components/ui/global/BackButton";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/constants/theme";
import FormField from "@/components/ui/auth/FormField";
import { api } from "@/lib/api";
import { toast } from "sonner-native";

export default function CreatePasswordScreen() {
  const theme = useTheme();
  const { email, otp } = useLocalSearchParams<{ email: string; otp: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [loading, setLoading] = useState(false);

  const passwordStatus = !password
    ? "default"
    : password.length >= 8
    ? "success"
    : "error";

  const confirmStatus = !confirmPassword
    ? "default"
    : confirmPassword === password
    ? "success"
    : "error";

  const isButtonEnabled =
    passwordStatus === "success" && confirmStatus === "success" && !loading;

  const resetPassword = async () => {
    if (!isButtonEnabled) return;
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, otp, newPassword: password });
      toast.success("Password reset successful", { description: "Please log in with your new password." });
      router.replace({
        pathname: "/(auth)/authentication",
        params: { mode: "login" },
      });
    } catch (err: any) {
      toast.error("Reset failed", { description: err.message });
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
          New Password
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.slideContent}>
          <Text style={[styles.description, { color: theme.text }]}>
            Create your new password
          </Text>
        </View>

        <View style={styles.bottomArea}>
          <View style={styles.optionsContainer}>
            <FormField
              title="Password"
              value={password}
              placeholder="New password"
              handleChangeText={setPassword}
              secureTextEntry={secureEntry}
              toggleSecureEntry={() => setSecureEntry((prev) => !prev)}
              autoComplete="password"
              status={passwordStatus}
            />
            <FormField
              title="Confirm Password"
              value={confirmPassword}
              placeholder="Confirm new password"
              handleChangeText={setConfirmPassword}
              secureTextEntry={secureConfirm}
              toggleSecureEntry={() => setSecureConfirm((prev) => !prev)}
              autoComplete="password"
              status={confirmStatus}
            />
          </View>

          <TouchableOpacity
            disabled={!isButtonEnabled}
            onPress={resetPassword}
            style={[
              styles.primaryButton,
              {
                backgroundColor: isButtonEnabled
                  ? theme.primary
                  : theme.primary + "33",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: "#fff", opacity: isButtonEnabled ? 1 : 0.6 },
                ]}
              >
                Reset Password
              </Text>
            )}
          </TouchableOpacity>
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
  title: {
    fontWeight: "600",
    fontSize: 28,
    marginBottom: 12,
  },
  description: {
    width: "100%",
    fontSize: 18,
    textAlign: "left",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  optionsContainer: {
    width: "100%",
    marginBottom: 30,
    gap: 20,
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
