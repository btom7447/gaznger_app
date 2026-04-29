import React, { useEffect, useState } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Avatar from "./Avatar";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

interface ProfileButtonProps {
  onPress: () => void;
  size?: number;
}

export default function ProfileButton({ onPress, size = 40 }: ProfileButtonProps) {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const [isVerified, setIsVerified] = useState(false);
  const [isPartner, setIsPartner] = useState(false);

  const initials = (user?.displayName ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    if (!user?.role) return;

    if (user.role === "rider") {
      api
        .get<{ isVerified?: boolean }>("/api/rider/profile")
        .then((data) => {
          setIsVerified(data?.isVerified === true);
          setIsPartner(false);
        })
        .catch(() => {});
    } else if (user.role === "vendor") {
      api
        .get<{ user: { vendorVerification?: { status: string }; partnerBadge?: { active: boolean } } }>(
          "/api/vendor/profile"
        )
        .then((data) => {
          setIsVerified(data.user?.vendorVerification?.status === "verified");
          setIsPartner(data.user?.partnerBadge?.active === true);
        })
        .catch(() => {});
    }
  }, [user?.role]);

  const wrapSize = size + 4;
  const borderRad = Math.round(size * 0.3) + 2;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ position: "relative" }}>
      <View
        style={[
          s.wrap,
          {
            width: wrapSize,
            height: wrapSize,
            borderRadius: borderRad,
            backgroundColor: theme.tertiary,
            borderColor: theme.primary + "33",
          },
        ]}
      >
        <Avatar uri={user?.profileImage} initials={initials} size={size} radius={borderRad - 2} />
      </View>

      {isPartner && (
        <View style={[s.dot, s.leftDot, { backgroundColor: theme.background }]}>
          <Ionicons name="ribbon-outline" size={13} color={theme.primary} />
        </View>
      )}

      {isVerified && (
        <View style={[s.dot, s.rightDot, { backgroundColor: theme.background }]}>
          <MaterialIcons name="verified" size={13} color="#22C55E" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  dot: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  leftDot: { left: -3, bottom: -3 },
  rightDot: { right: -3, bottom: -3 },
});
