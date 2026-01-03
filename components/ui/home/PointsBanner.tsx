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

export default function PointsBanner() {
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
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/points/${user.id}`
      );
      if (!res.ok) throw new Error("Failed to fetch points");

      const data = await res.json();

      // Use available points
      const availablePoints = typeof data.points === "number" ? data.points : 0;

      // Update store
      updateUser({ points: availablePoints });

      // Animate only if points changed
      if (availablePoints !== displayPoints) {
        Animated.timing(animatedPoints, {
          toValue: availablePoints,
          duration: 800,
          easing: Easing.out(Easing.exp),
          useNativeDriver: false,
        }).start();
      }
    } catch (err) {
      console.error("Error fetching points:", err);
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

  // Auto-refresh points every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchPoints, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const points = displayPoints;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, borderColor: theme.quaternary },
      ]}
    >
      {/* Left Section: Coin + Points */}
      <View style={styles.leftSection}>
        <Image
          source={require("../../../assets/icons/coin-icon.png")}
          style={styles.coinImage}
        />
        <View style={styles.pointsInfo}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Animated.Text
              style={[
                styles.pointsValue,
                {
                  color: theme.text,
                  opacity: animatedPoints.interpolate({
                    inputRange: [0, points],
                    outputRange: [0.3, 1],
                  }),
                },
              ]}
            >
              {points.toLocaleString()}
            </Animated.Text>
          )}
          <Text style={[styles.pointsLabel, { color: theme.text }]}>
            Points
          </Text>
        </View>
      </View>

      {/* Right Section: Poster + Redeem Button */}
      <View style={styles.rightSection}>
        <Image
          source={require("../../../assets/images/points/points-poster.png")}
          style={styles.posterImage}
        />
        <TouchableOpacity
          style={[styles.redeemButton, { backgroundColor: theme.background }]}
          onPress={async () => {
            // Trigger fetch + animation
            await fetchPoints();
          }}
        >
          <Text style={[styles.redeemText, { color: theme.text }]}>Redeem</Text>
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
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  leftSection: {
    flex: 6,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  coinImage: {
    width: 80,
    height: 40,
    marginRight: 12,
    borderRadius: 16,
    resizeMode: "cover",
  },
  pointsInfo: {
    flexDirection: "column",
    alignItems: "center",
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: "600",
  },
  pointsLabel: {
    fontSize: 16,
    fontWeight: "300",
  },
  rightSection: {
    flex: 5,
    height: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingRight: 20,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  posterImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  redeemButton: {
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
    alignSelf: "center",
  },
  redeemText: {
    fontSize: 16,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});