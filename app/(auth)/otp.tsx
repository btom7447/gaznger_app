import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import OTPField from "@/components/ui/auth/OTPField";
import BackButton from "@/components/ui/global/BackButton";
import { router, useLocalSearchParams } from "expo-router";
import { maskEmail } from "@/utils/mask";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { toast } from "sonner-native";

export default function OtpScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ email: string; type?: string; role?: string }>();
  const { email, type, role } = params;
  const isReset = type === "reset";

  if (!email) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ textAlign: "center", marginTop: 50, color: theme.text }}>
          Missing OTP parameters
        </Text>
      </View>
    );
  }

  const maskedEmail = maskEmail(email);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"default" | "success" | "error">("default");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const isOtpComplete = otp.every((digit) => digit !== "");
  const otpString = otp.join("");

  const verifyCode = async () => {
    if (!isOtpComplete) return;
    setLoading(true);

    try {
      if (isReset) {
        // For password reset: pass otp + email directly to create screen
        // (actual verification happens server-side at reset-password endpoint)
        setStatus("success");
        router.push({
          pathname: "/(auth)/create",
          params: { email, otp: otpString },
        });
      } else {
        await api.post("/auth/verify-otp", { email, otp: otpString });
        setStatus("success");
        if (role === "vendor") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.replace("/(vendor)/onboarding" as any);
        } else if (role === "rider") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.replace("/(rider)/onboarding" as any);
        } else {
          router.replace("/(auth)/onboarding");
        }
      }
    } catch (err: any) {
      setStatus("error");
      toast.error("Verification failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (timer > 0 || resending) return;

    setResending(true);
    setOtp(["", "", "", "", "", ""]);
    setStatus("default");
    setTimer(30);

    try {
      await api.post("/auth/resend-otp", { email });
    } catch (err: any) {
      toast.error("Could not resend OTP", { description: err.message });
    } finally {
      setResending(false);
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
          {isReset ? "Reset Password" : "Email Verification"}
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
          <Text style={[styles.description, { color: theme.text }]}>
            {`Enter code sent to ${maskedEmail}`}
          </Text>
        </View>

        <View style={styles.otpContainer}>
          <OTPField otp={otp} setOtp={setOtp} length={6} status={status} />
        </View>

        <Text style={[styles.description, { color: theme.text }]}>
          Resend code in
          <Text style={[styles.termsLink, { color: theme.text }]}>{` ${timer} `}</Text>
          s
        </Text>

        <TouchableOpacity
          onPress={verifyCode}
          disabled={!isOtpComplete || loading}
          style={[
            styles.verifyBtn,
            {
              opacity: isOtpComplete && !loading ? 1 : 0.5,
              backgroundColor: theme.quaternary,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={[styles.verifyText, { color: "#FFF" }]}>
              {isReset ? "Continue" : "Verify"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ marginTop: 20 }}>
          {timer === 0 && (
            <Text style={[styles.resendText, { color: theme.text }]}>
              Didn't receive the code?{" "}
              <Text
                style={[styles.termsLink, { color: theme.primary }]}
                onPress={resendOtp}
              >
                {resending ? "Resending..." : "Click here"}
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
  title: { fontWeight: "700", fontSize: 25, marginBottom: 12 },
  description: { fontSize: 16, textAlign: "center", lineHeight: 22 },
  otpContainer: { marginVertical: 40 },
  verifyBtn: {
    paddingVertical: 17,
    borderRadius: 10,
    marginVertical: 30,
    marginTop: 50,
    alignItems: "center",
  },
  verifyText: { fontSize: 20, fontWeight: "600" },
  resendText: { textAlign: "left", fontSize: 18, lineHeight: 22 },
  termsLink: {},
});
