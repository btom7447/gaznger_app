import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import FormField from "./FormField";
import { router } from "expo-router";
import { useTheme } from "@/constants/theme";

export default function PasswordForm() {
  const theme = useTheme();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);

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
    passwordStatus === "success" && confirmStatus === "success";

  const createPassword = () => {
    router.push({
      pathname: "/(auth)/authentication",
      params: { mode: "login" },
    });
  };

  return (
    <View style={{ width: "100%" }}>
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
        disabled={!isButtonEnabled}
        onPress={createPassword}
        style={{
          marginTop: 20,
          backgroundColor: isButtonEnabled
            ? theme.primary
            : theme.primary + "33", // semi-transparent when disabled
          paddingVertical: 16,
          borderRadius: 28,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 18,
            fontWeight: "600",
            opacity: isButtonEnabled ? 1 : 0.6,
          }}
        >
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}