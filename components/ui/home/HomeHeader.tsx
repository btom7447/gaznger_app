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
        <View>
          <Text style={[styles.greetingSub, { color: theme.icon }]}>Good day 👋</Text>
          <Text style={[styles.greeting, { color: theme.text }]}>{firstName}</Text>
        </View>
      );
    }

    return <View />;
  };

  return (
    <View style={styles.header}>
      <View style={styles.left}>{renderLeft()}</View>

      <View style={styles.right}>
        <NotificationButton
          onPress={() => router.push("/(screens)/notification")}
        />

        <ProfileCard
          image={user?.profileImage}
          initials={user?.displayName?.split(" ").map((w) => w[0]).join("").slice(0, 2)}
          onPress={() => router.push("/(screens)/profile" as any)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
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
    gap: 10,
  },
  greetingSub: {
    fontSize: 13,
    fontWeight: "300",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "500",
    letterSpacing: -0.3,
  },
});
