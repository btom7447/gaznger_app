import React, { useRef, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";

interface OTPFieldProps {
  otp: string[];
  setOtp: (value: string[]) => void;
  length?: number;
  status?: "default" | "success" | "error"; // controls colors
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
    if (focusedIndex === index || otp[index]) return theme.primary;
    return theme.quaternary;
  };

  const getBackgroundColor = (index: number) => {
    if (status === "success") return theme.quaternary + "0D"; // light transparent green
    if (status === "error") return theme.error + "0D"; // light transparent red for dark/light mode
    return theme.secondary;
  };

  const getTextColor = () => {
    return theme.text;
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => (
        <TextInput
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el!;
          }}
          value={otp[index]}
          maxLength={1}
          keyboardType="numeric"
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => setFocusedIndex(null)}
          onChangeText={(t) => handleChange(t, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          style={[
            styles.input,
            {
              backgroundColor: getBackgroundColor(index),
              borderColor: getBorderColor(index),
              color: getTextColor(),
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
    borderWidth: 1,
    borderRadius: 15,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
  },
});
