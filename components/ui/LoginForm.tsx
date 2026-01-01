import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import FormField from "./FormField";
import { useRouter } from "expo-router";
import { useSessionStore } from "@/store/useSessionStore";
import { mapBackendUser } from "@/utils/mapBackendUser";
import { useTheme } from "@/constants/theme";

export default function LoginForm() {
  const theme = useTheme();
  const router = useRouter();

  const loginSession = useSessionStore((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secureEntry, setSecureEntry] = useState(true);

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

  const goToForgotPassword = () => router.replace("/(auth)/forgot");

  const isButtonEnabled =
    emailStatus === "success" && passwordStatus === "success";

  const login = async () => {
    if (!isButtonEnabled) return;

    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await res.json();

      useSessionStore.getState().login({
        user: mapBackendUser(data.user),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      router.replace("/(tabs)/(home)");
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <View style={{ width: "100%", flexDirection: "column", gap: 20, }}>
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
        placeholder="*******"
        handleChangeText={setPassword}
        secureTextEntry={secureEntry}
        toggleSecureEntry={() => setSecureEntry((prev) => !prev)}
        autoComplete="password"
        status={passwordStatus}
      />

      <View style={styles(theme).forgotContainer}>
        <Text style={styles(theme).termsLink} onPress={goToForgotPassword}>
          Forgot your password?
        </Text>
      </View>

      <TouchableOpacity
        onPress={login}
        disabled={!isButtonEnabled}
        accessibilityState={{ disabled: !isButtonEnabled }}
        style={[
          styles(theme).buttonBase,
          {
            backgroundColor: isButtonEnabled
              ? theme.quaternary
              : theme.quaternary + "33",
          },
        ]}
      >
        <Text style={styles(theme).buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    buttonBase: {
      marginTop: 10,
      paddingVertical: 17,
      borderRadius: 10,
      alignItems: "center",
    },
    buttonText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "600",
    },
    forgotContainer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    termsLink: {
      color: theme.primary,
      fontSize: 18,
    },
  });
