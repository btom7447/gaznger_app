import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  ScrollView,
} from "react-native";
import OTPField from "@/components/ui/OTPField";
import BackButton from "@/components/ui/BackButton";
import { router, useLocalSearchParams } from "expo-router";
import { maskEmail, maskPhone } from "@/utils/mask";
import { useTheme } from "@/constants/theme";

export default function OtpScreen() {
  const theme = useTheme();

  const params = useLocalSearchParams<{
    method: "sms" | "email";
    email: string;
    phone: string;
  }>();
  const { method, email, phone } = params;

  if (!method || !email || !phone) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ textAlign: "center", marginTop: 50, color: theme.text }}>
          Missing OTP parameters
        </Text>
      </View>
    );
  }

  const masked = method === "sms" ? maskPhone(phone) : maskEmail(email);

  const [otp, setOtp] = useState(["", "", "", "", ""]);
  const [status, setStatus] = useState<"default" | "success" | "error">(
    "default"
  );
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const verifyCode = () => {
    const isCorrect = otp.join("") === "12345";
    setStatus(isCorrect ? "success" : "error");

    if (isCorrect) {
      setTimeout(() => {
        router.push("/(auth)/create");
      }, 700);
    }
  };

  const resendOtp = () => {
    if (timer === 0) {
      setOtp(["", "", "", "", ""]);
      setStatus("default");
      setTimer(30);
    }
  };

  const isOtpComplete = otp.every((digit) => digit !== "");

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
          <View style={styles.imageWrapper}>
            <Image
              source={require("@/assets/icons/alert.png")}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            OTP Verification
          </Text>
          <Text style={[styles.description, { color: theme.error }]}>
            {`Code has been sent to ${masked}`}
          </Text>
        </View>

        <View style={styles.otpContainer}>
          <OTPField otp={otp} setOtp={setOtp} length={5} status={status} />
        </View>

        <Text style={[styles.description, { color: theme.error }]}>
          Resend code in
          <Text
            style={[styles.termsLink, { color: theme.error }]}
          >{` ${timer} `}</Text>
          s
        </Text>

        <TouchableOpacity
          disabled={!isOtpComplete}
          style={[
            styles.verifyBtn,
            {
              opacity: isOtpComplete ? 1 : 0.5,
              backgroundColor: theme.primary,
            },
          ]}
          onPress={verifyCode}
        >
          <Text style={[styles.verifyText, { color: theme.text }]}>Verify</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 20 }}>
          {timer === 0 && (
            <Text style={[styles.resendText, { color: theme.error }]}>
              Didn't receive the code?{" "}
              <Text
                style={[styles.termsLink, { color: theme.error }]}
                onPress={resendOtp}
              >
                Click here
              </Text>
            </Text>
          )}
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
  scrollView: { paddingHorizontal: 20 },
  slideContent: { alignItems: "center" },
  imageWrapper: { height: 80, marginVertical: 30 },
  image: { width: "100%", height: "100%", aspectRatio: 1 },
  title: { fontWeight: "600", fontSize: 28, marginBottom: 12 },
  description: { fontSize: 18, textAlign: "center", lineHeight: 22 },
  otpContainer: { marginVertical: 40 },
  verifyBtn: {
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 10,
    marginVertical: 30,
    marginTop: 50,
  },
  verifyText: { fontSize: 20, fontWeight: "600" },
  resendText: { textAlign: "left", fontSize: 18, lineHeight: 22 },
  termsLink: {},
});
