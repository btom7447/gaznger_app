import React, { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileCard from "@/components/ui/global/ProfileCard";
import { router } from "expo-router";

type HeaderVariant = "home" | "order" | "default";

interface AppHeaderProps {
  variant?: HeaderVariant;
  user?: {
    displayName?: string;
    profileImage?: string;
  } | null;
  leftSlot?: ReactNode;
}

export default function HomeHeader({
  variant = "default",
  user = null,
  leftSlot,
}: AppHeaderProps) {
  const theme = useTheme();

  const firstName = user?.displayName
    ? user.displayName.split(" ")[0]
    : "Guest";

  const renderLeft = () => {
    if (leftSlot) return leftSlot;

    if (variant === "home") {
      return (
        <Text style={[styles.greeting, { color: theme.text }]}>
          Hello {firstName}!
        </Text>
      );
    }

    // order / default → keep spacing, render nothing
    return <View />;
  };

  return (
    <View style={styles.header}>
      <View style={styles.left}>{renderLeft()}</View>

      <View style={styles.right}>
        <NotificationButton
          count={3}
          onPress={() => router.push("/notification")}
        />

        <ProfileCard
          image={user?.profileImage}
          onPress={() => router.push("/profile")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  left: {
    flex: 1,
    justifyContent: "center",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
  },
});
