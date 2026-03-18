import React, { memo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

// All MaterialIcons — consistent filled style across all steps
const STEPS = [
  { label: "Fuel",    icon: "whatshot" },
  { label: "Address", icon: "person-pin"           },
  { label: "Station", icon: "local-gas-station"     },
];

export default memo(function OrderProgressBar() {
  const theme = useTheme();
  const progressStep = useOrderStore((s) => s.progressStep);

  const anims = useRef(STEPS.slice(0, -1).map(() => new Animated.Value(0))).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: progressStep > i ? 1 : 0,
        duration: 350,
        useNativeDriver: false,
      }).start();
    });
  }, [progressStep]);

  const s = styles(theme);

  return (
    <View style={s.wrapper}>
      {STEPS.map((step, i) => {
        const isCompleted = i < progressStep;
        const isActive = i === progressStep;

        return (
          <React.Fragment key={step.label}>
            <View style={s.stepCol}>
              <View style={[
                s.dot,
                isCompleted && { backgroundColor: theme.secondary, borderColor: theme.secondary },
                isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
                !isCompleted && !isActive && { backgroundColor: theme.surface, borderColor: theme.ash },
              ]}>
                {isCompleted
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <MaterialIcons name={step.icon as any} size={18} color={isActive ? "#fff" : theme.icon} />
                }
              </View>
              <Text style={[
                s.label,
                { color: isActive ? theme.primary : isCompleted ? theme.secondary : theme.icon },
                (isActive || isCompleted) && { fontWeight: "500" },
              ]}>
                {step.label}
              </Text>
            </View>

            {i < STEPS.length - 1 && (
              <View style={s.connector}>
                <View style={[s.connectorBase, { backgroundColor: theme.ash }]} />
                <Animated.View style={[
                  s.connectorFill,
                  {
                    backgroundColor: theme.secondary,
                    width: anims[i].interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  },
                ]} />
              </View>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    stepCol: { alignItems: "center", gap: 5 },
    dot: {
      width: 25, height: 25, borderRadius: 15,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1.5,
    },
    label: { fontSize: 10, fontWeight: "300", textAlign: "center" },
    connector: {
      flex: 1, height: 2, marginHorizontal: 4,
      borderRadius: 1, overflow: "hidden",
      marginBottom: 14,
    },
    connectorBase: { position: "absolute", width: "100%", height: "100%", borderRadius: 1 },
    connectorFill: { position: "absolute", height: "100%", left: 0, top: 0, borderRadius: 1 },
  });
