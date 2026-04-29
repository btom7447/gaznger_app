import React, { useEffect, useMemo, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Theme, useTheme } from "@/constants/theme";
import { Button } from "@/components/ui/primitives";
import { NotificationItem } from "./NotificationRow";

interface PinnedUrgentProps {
  notif: NotificationItem;
  onOpen: (notif: NotificationItem) => void;
}

/**
 * "Rider arrived" / "Payment failed" pinned banner.
 * Pulse dot top-right; halts under reduced motion.
 */
export default function PinnedUrgent({ notif, onOpen }: PinnedUrgentProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    let anim: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted || reduced) return;
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    });
    return () => {
      mounted = false;
      anim?.stop();
    };
  }, [opacity]);

  return (
    <View
      style={styles.card}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Animated.View style={[styles.pulse, { opacity }]} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {notif.title}
        </Text>
        <Text style={styles.bodyText} numberOfLines={2}>
          {notif.body}
        </Text>
      </View>
      <Button variant="primary" size="sm" onPress={() => onOpen(notif)}>
        Open
      </Button>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      padding: theme.space.s3 + 2,
      marginHorizontal: theme.space.s4,
      marginVertical: theme.space.s2,
    },
    pulse: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
    body: { flex: 1, gap: 2 },
    title: {
      ...theme.type.body,
      fontWeight: "800",
      color: theme.primary,
    },
    bodyText: {
      ...theme.type.bodySm,
      color: theme.fg,
    },
  });
