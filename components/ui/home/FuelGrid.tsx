import React, { memo, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { useOrderStore, FuelType } from "@/store/useOrderStore";

/* Skeleton Card for loading state */
const SkeletonCard = memo(() => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={styles.skeletonCard} />;
});

export default function FuelGrid() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const fuelTypes = useOrderStore((s) => s.fuelTypes);
  const currentFuelId = useOrderStore((s) => s.order.fuel?._id);
  const setFuel = useOrderStore((s) => s.setFuel);
  const setProgressStep = useOrderStore((s) => s.setProgressStep);

  const handleSelect = useCallback(
    (fuel: FuelType) => {
      if (!fuel) return;
      if (fuel._id === currentFuelId) return;

      // Set fuel in store and reset progress step
      setFuel(fuel);
      setProgressStep(0);

      // Navigate to order screen
      router.push("/(tabs)/(order)");
    },
    [currentFuelId, setFuel, setProgressStep, router]
  );

  if (!fuelTypes.length) {
    return (
      <View style={styles.container}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {fuelTypes.map((fuel) => (
        <FuelCard key={fuel._id} fuel={fuel} onSelect={handleSelect} />
      ))}
    </View>
  );
}

/* FuelCard */
interface FuelCardProps {
  fuel: FuelType;
  onSelect: (fuel: FuelType) => void;
}

const FuelCard = memo(({ fuel, onSelect }: FuelCardProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect(fuel)}
      style={styles.card}
    >
      {fuel.icon ? (
        <Image
          source={{ uri: fuel.icon }}
          style={styles.icon}
          resizeMode="contain"
        />
      ) : null}
      <Text style={styles.text}>{fuel.name}</Text>
    </TouchableOpacity>
  );
});

/* Styles */
const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 20,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 10,
    },
    card: {
      width: "45%",
      paddingVertical: 30,
      paddingHorizontal: 10,
      borderRadius: 20,
      alignItems: "center",
      backgroundColor: theme.background,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 4,
    },
    text: { marginTop: 10, fontSize: 16, fontWeight: "600", color: theme.text },
    icon: { width: 80, height: 80 },
    skeletonCard: {
      width: "45%",
      height: 110,
      borderRadius: 20,
      backgroundColor: theme.secondary,
      opacity: 0.4,
    },
  });