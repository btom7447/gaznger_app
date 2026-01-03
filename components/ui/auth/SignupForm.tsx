import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import FormField from "./FormField";
import { router } from "expo-router";
import { useSessionStore } from "@/store/useSessionStore";
import { mapBackendUser } from "@/utils/mapBackendUser";
import { useTheme } from "@/constants/theme";

export default function SignupForm() {
  const theme = useTheme();
  const loginSession = useSessionStore((state) => state.login);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [loading, setLoading] = useState(false); // NEW: track loading state

  const emailStatus = !email
    ? "default"
    : /^\S+@\S+\.\S+$/.test(email)
    ? "success"
    : "error";

  const passwordStatus = !password
    ? "default"
    : password.length >= 6
    ? "success"
    : "error";

  const confirmStatus = !confirmPassword
    ? "default"
    : confirmPassword === password
    ? "success"
    : "error";

  const isButtonEnabled =
    emailStatus === "success" &&
    passwordStatus === "success" &&
    confirmStatus === "success" &&
    !loading; // disable if loading

  const signup = async () => {
    if (!isButtonEnabled) return;

    setLoading(true); // start loading
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            phone,
            password,
            displayName,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Signup failed");
      }

      console.log("User Registered, navigate to OTP");

      // Navigate to OTP screen with email param
      router.push({
        pathname: "/(auth)/otp",
        params: { email: data.user.email }, // pass email
      });
    } catch (err: any) {
      console.error("Signup error:", err.message || err);
    } finally {
      setLoading(false); // stop loading
    }
  };

  return (
    <View
      style={{
        paddingHorizontal: 20,
        width: "100%",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <FormField
        title="Email"
        value={email}
        placeholder="johndoe@gmail.com"
        handleChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        status={emailStatus}
      />

      <FormField
        title="Password"
        value={password}
        placeholder="Password"
        handleChangeText={setPassword}
        secureTextEntry={secureEntry}
        toggleSecureEntry={() => setSecureEntry((prev) => !prev)}
        autoComplete="password"
        status={passwordStatus}
      />

      <FormField
        title="Confirm Password"
        value={confirmPassword}
        placeholder="Confirm Password"
        handleChangeText={setConfirmPassword}
        secureTextEntry={secureConfirm}
        toggleSecureEntry={() => setSecureConfirm((prev) => !prev)}
        autoComplete="password"
        status={confirmStatus}
      />

      <TouchableOpacity
        onPress={signup}
        disabled={!isButtonEnabled}
        style={[
          styles(theme).button,
          {
            backgroundColor: isButtonEnabled
              ? theme.quaternary
              : theme.quaternary + "33",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" /> // show loader
        ) : (
          <Text
            style={[
              styles(theme).buttonText,
              { opacity: isButtonEnabled ? 1 : 0.6 },
            ]}
          >
            Sign Up
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    button: {
      marginTop: 20,
      paddingVertical: 16,
      borderRadius: 10,
      alignItems: "center",
    },
    buttonText: {
      color: "#FFF",
      fontSize: 18,
      fontWeight: "600",
    },
  });
