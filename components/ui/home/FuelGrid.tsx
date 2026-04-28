import React, { memo, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { useOrderStore, FuelType } from "@/store/useOrderStore";
import SkeletonBox from "@/components/ui/skeletons/SkeletonBox";
import { useActiveOrder } from "@/hooks/useActiveOrder";

// Local fuel icons — always available, no network dependency
const FUEL_LOCAL_ICON: Record<string, ImageSourcePropType> = {
  petrol: require("../../../assets/icons/fuel/petrol-icon.png"),
  diesel: require("../../../assets/icons/fuel/diesel-icon.png"),
  gas:    require("../../../assets/icons/fuel/gas-icon.png"),
  oil:    require("../../../assets/icons/fuel/oil-icon.png"),
};

/* Skeleton Card for loading state */
const SkeletonCard = memo(() => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.card, { borderColor: theme.ash }]}>
      <SkeletonBox width={68} height={68} borderRadius={34} style={{ marginBottom: 12 }} />
      <SkeletonBox width={72} height={12} borderRadius={6} />
    </View>
  );
});

export default function FuelGrid() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const fuelTypes = useOrderStore((s) => s.fuelTypes);
  const isFetchingFuelTypes = useOrderStore((s) => s.isFetchingFuelTypes);
  const currentFuelId = useOrderStore((s) => s.order.fuel?._id);
  const setFuel = useOrderStore((s) => s.setFuel);
  const setProgressStep = useOrderStore((s) => s.setProgressStep);
  const { hasActiveOrder } = useActiveOrder();

  const handleSelect = useCallback(
    (fuel: FuelType) => {
      if (!fuel) return;

      if (hasActiveOrder) {
        toast.error("You have an active order", {
          description: "Track your current order first",
        });
        router.push("/(customer)/(track)" as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        return;
      }

      if (fuel._id === currentFuelId) return;

      // Set fuel in store and reset progress step
      setFuel(fuel);
      setProgressStep(0);

      // Navigate to order screen
      router.push("/(customer)/(order)" as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    [hasActiveOrder, currentFuelId, setFuel, setProgressStep, router]
  );

  if (isFetchingFuelTypes && !fuelTypes.length) {
    return (
      <View style={styles.container}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }

  if (!fuelTypes.length) {
    return (
      <View style={[styles.container, { justifyContent: "center", paddingVertical: 32 }]}>
        <Text style={{ color: theme.icon, fontSize: 14, textAlign: "center" }}>
          No fuel types available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {fuelTypes.map((fuel) => (
        <FuelCard key={fuel._id} fuel={fuel} onSelect={handleSelect} locked={hasActiveOrder} />
      ))}
    </View>
  );
}

/* FuelCard */
interface FuelCardProps {
  fuel: FuelType;
  onSelect: (fuel: FuelType) => void;
  locked?: boolean;
}

const FuelCard = memo(({ fuel, onSelect, locked }: FuelCardProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect(fuel)}
      style={[styles.card, locked && { opacity: 0.5 }]}
    >
      <View style={styles.iconWrap}>
        <Image
          source={
            fuel.icon
              ? { uri: fuel.icon }
              : (FUEL_LOCAL_ICON[fuel.name.toLowerCase()] ?? FUEL_LOCAL_ICON.petrol)
          }
          style={styles.icon}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.text}>{fuel.name}</Text>
      {locked && (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={14} color={theme.icon} />
        </View>
      )}
    </TouchableOpacity>
  );
});

/* Styles */
const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 14,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 8,
      marginBottom: 10,
    },
    card: {
      width: "48%",
      paddingVertical: 24,
      paddingHorizontal: 14,
      borderRadius: 18,
      alignItems: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.ash,
    },
    iconWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.tertiary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    icon: { width: 55, height: 55 },
    text: { fontSize: 15, fontWeight: "400", color: theme.text, textAlign: "center" },
    subtext: { fontSize: 12, fontWeight: "300", color: theme.icon, marginTop: 4 },
    lockOverlay: {
      position: "absolute",
      top: 8,
      right: 8,
    },
  });