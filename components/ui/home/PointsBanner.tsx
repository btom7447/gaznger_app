import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";

interface PointsBannerProps {
  onOpenRedeem?: () => void;
}

export default function PointsBanner({ onOpenRedeem }: PointsBannerProps = {}) {
  const theme = useTheme();
  const user = useSessionStore((state) => state.user);
  const updateUser = useSessionStore((state) => state.updateUser);

  const [loading, setLoading] = useState(false);

  // Initialize animated value with current user points
  const animatedPoints = useRef(new Animated.Value(user?.points || 0)).current;
  const [displayPoints, setDisplayPoints] = useState(user?.points || 0);

  const fetchPoints = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await api.get<{ points: number }>("/api/points");

      const availablePoints = typeof data.points === "number" ? data.points : 0;

      updateUser({ points: availablePoints });

      if (availablePoints !== displayPoints) {
        Animated.timing(animatedPoints, {
          toValue: availablePoints,
          duration: 800,
          easing: Easing.out(Easing.exp),
          useNativeDriver: false,
        }).start();
      }
    } catch {
      // silent — points display will retain last known value
    } finally {
      setLoading(false);
    }
  };

  // Listen for animated value changes
  useEffect(() => {
    const listener = animatedPoints.addListener(({ value }) => {
      setDisplayPoints(Math.round(value));
    });
    return () => animatedPoints.removeListener(listener);
  }, [animatedPoints]);

  // Fetch points on mount and whenever user ID changes
  useEffect(() => {
    fetchPoints();
  }, [user?.id]);

  // Real-time: update points instantly via WebSocket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ points }: { points: number }) => {
      updateUser({ points });
      Animated.timing(animatedPoints, {
        toValue: points,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false,
      }).start();
    };
    socket.on("points:update", handler);
    return () => { socket.off("points:update", handler); };
  }, []);

  const points = displayPoints;

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* Left: points */}
      <View style={styles.leftSection}>
        <Image
          source={require("../../../assets/icons/coin-icon.png")}
          style={styles.coinImage}
        />
        <View>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Animated.Text style={styles.pointsValue}>
              {points.toLocaleString()}
            </Animated.Text>
          )}
          <Text style={styles.pointsLabel}>Gaznger Points</Text>
        </View>
      </View>

      {/* Right: poster + redeem */}
      <View style={styles.rightSection}>
        <Image
          source={require("../../../assets/images/points/points-poster.png")}
          style={styles.posterImage}
        />
        <TouchableOpacity
          style={[styles.redeemButton, { backgroundColor: theme.accent }]}
          onPress={onOpenRedeem}
          activeOpacity={0.85}
        >
          <Text style={styles.redeemText}>Redeem</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
    height: 100,
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 12,
  },
  coinImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    resizeMode: "cover",
  },
  pointsValue: {
    fontSize: 26,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: "300",
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  rightSection: {
    width: 160,
    height: "100%",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 16,
    position: "relative",
  },
  posterImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    opacity: 0.5,
  },
  redeemButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 20,
    zIndex: 10,
  },
  redeemText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0C1A0C",
  },
});