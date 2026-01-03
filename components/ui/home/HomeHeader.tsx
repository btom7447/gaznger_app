import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileCard from "@/components/ui/global/ProfileCard";
import { router } from "expo-router";

interface HomeHeaderProps {
  user: {
    displayName?: string;
    profileImage?: string;
  } | null;
}

export default function HomeHeader({ user }: HomeHeaderProps) {
  const theme = useTheme();

  const firstName = user?.displayName
    ? user.displayName.split(" ")[0]
    : "Guest";

  return (
    <View style={styles.header}>
      <Text style={[styles.greeting, { color: theme.text }]}>
        Hello {firstName}!
      </Text>

      <View style={styles.rightActions}>
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
