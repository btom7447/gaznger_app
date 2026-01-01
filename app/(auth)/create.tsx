import BackButton from "@/components/ui/BackButton";
import { router } from "expo-router";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  StatusBar,
  Image,
} from "react-native";
import React from "react";
import PasswordForm from "@/components/ui/PasswordForm";
import { useTheme } from "@/constants/theme";

export default function CreatePasswordScreen() {
  const theme = useTheme();

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
          {/* <View style={styles.imageWrapper}>
            <Image
              source={require("@/assets/images/onboarding/forgot-thumbnail.png")}
              style={styles.image}
              resizeMode="contain"
            />
          </View> */}
          <Text style={[styles.description, { color: theme.text }]}>
            Create Your New Password
          </Text>
        </View>

        <View style={styles.bottomArea}>
          <View style={styles.optionsContainer}>
            <PasswordForm />
          </View>
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
