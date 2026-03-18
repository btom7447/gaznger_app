import React, { useRef, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";

interface OTPFieldProps {
  otp: string[];
  setOtp: (value: string[]) => void;
  length?: number;
  status?: "default" | "success" | "error";
}

export default function OTPField({
  otp,
  setOtp,
  length = 5,
  status = "default",
}: OTPFieldProps) {
  const theme = useTheme();
  const inputRefs = useRef<TextInput[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleChange = (text: string, index: number) => {
    // Autofill / paste — full code arrives as a multi-character string
    if (text.length > 1) {
      const digits = text.replace(/\D/g, "").slice(0, length).split("");
      const updated = Array(length).fill("");
      digits.forEach((d, i) => { updated[i] = d; });
      setOtp(updated);
      const lastFilled = Math.min(digits.length - 1, length - 1);
      inputRefs.current[lastFilled]?.focus();
      return;
    }

    if (/^\d?$/.test(text)) {
      const updated = [...otp];
      updated[index] = text;
      setOtp(updated);
      if (text && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const getBorderColor = (index: number) => {
    if (status === "success") return theme.secondary;
    if (status === "error") return theme.error;
    if (focusedIndex === index) return theme.secondary;
    if (otp[index]) return theme.secondary + "80";
    return theme.mode === "dark" ? "#ffffff30" : "#00000020";
  };

  const getBackgroundColor = (index: number) => {
    if (status === "success") return theme.tertiary;
    if (status === "error") return theme.mode === "dark" ? "#ff000015" : theme.background;
    if (focusedIndex === index) return theme.quinest;
    if (otp[index]) return theme.mode === "dark" ? "#ffffff10" : theme.quinest;
    return theme.mode === "dark" ? "#ffffff08" : theme.background;
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => (
        <TextInput
          key={index}
          ref={(el) => { inputRefs.current[index] = el!; }}
          value={otp[index]}
          maxLength={length}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => setFocusedIndex(null)}
          onChangeText={(t) => handleChange(t, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          style={[
            styles.input,
            {
              backgroundColor: getBackgroundColor(index),
              borderColor: getBorderColor(index),
              color: theme.text,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  input: {
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderRadius: 15,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
  },
});
