import React, { memo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

const STEPS = ["Order", "Payment", "Tracking"];

export default memo(function OrderProgressBar() {
  const theme = useTheme();
  const progressStep = useOrderStore((s) => s.progressStep);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressStep,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progressStep]);

  return (
    <View style={styles.wrapper}>
      {STEPS.map((label, index) => {
        const isCompleted = index < progressStep;
        const isActive = index === progressStep;

        return (
          <React.Fragment key={label}>
            {/* Step */}
            <View style={styles.step}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor:
                      isCompleted || isActive ? theme.secondary : theme.ash,
                  },
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={styles.circleText}>{index + 1}</Text>
                )}
              </View>

              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? theme.secondary : theme.ash,
                  },
                ]}
              >
                {label}
              </Text>
            </View>

            {/* Line */}
            {index < STEPS.length - 1 && (
              <View style={styles.lineWrapper}>
                <View
                  style={[styles.lineBase, { borderColor: theme.secondary }]}
                />

                <Animated.View
                  style={[
                    styles.lineFill,
                    {
                      backgroundColor: theme.secondary,
                      width: progressAnim.interpolate({
                        inputRange: [index, index + 1],
                        outputRange: ["0%", "100%"],
                        extrapolate: "clamp",
                      }),
                    },
                  ]}
                />
              </View>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  step: {
    alignItems: "center",
    width: 70,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  circleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  lineWrapper: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    justifyContent: "center",
  },
  lineBase: {
    position: "absolute",
    width: "100%",
    borderTopWidth: 1.5,
    borderStyle: "dashed",
  },
  lineFill: {
    position: "absolute",
    height: 2,
    left: 0,
    top: 0,
  },
});
