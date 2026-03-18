import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useEffect,
  useState,
} from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { Modalize } from "react-native-modalize";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { Station } from "@/types";

interface StationDetailsModalProps {
  station: Station;
  onClose: () => void;
  onConfirm?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const StationDetailsModal = forwardRef<Modalize, StationDetailsModalProps>(
  ({ station, onClose, onConfirm }, ref) => {
    const theme = useTheme();
    const modalRef = useRef<Modalize>(null);

    const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
    const [buttonOpacity] = useState(new Animated.Value(0));

    useImperativeHandle(ref, () => ({
      open: () => {
        modalRef.current?.open();
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 150,
          damping: 18,
        }).start();
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      },
      close: () => modalRef.current?.close(),
    }));

    if (!station) return null;

    const estimateDeliveryTime = (distanceKm?: number) => {
      if (!distanceKm) return 0;

      const AVERAGE_SPEED_KMH = 20; // city driving
      const minutes = (distanceKm / AVERAGE_SPEED_KMH) * 120;

      return Math.max(1, Math.round(minutes)); // at least 1 minute
    };

    return (
      <Modalize
        ref={modalRef}
        modalHeight={450}
        panGestureEnabled={false}
        withHandle={false}
        modalStyle={{
          backgroundColor: theme.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 20,
        }}
        useNativeDriver
        onClosed={onClose}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <Image
            source={{ uri: station.image }}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: theme.text }]}>{station.name}</Text>
            {station.verified && (
              <MaterialIcons
                name="verified"
                size={18}
                color={theme.quaternary}
                style={{ marginLeft: 6 }}
              />
            )}
          </View>
          <View style={styles.addressRow}>
            <MaterialIcons
              name="place"
              size={16}
              color={theme.text}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.address, { color: theme.icon }]}>{station.address}</Text>
          </View>
          <View style={styles.ratingRow}>
            <Text style={{ color: "#4CAF50", fontWeight: "600" }}>
              Rating: {station.rating?.toFixed(1) || "0.0"}
            </Text>
            <MaterialIcons
              name="star-rate"
              size={16}
              color="#FFD700"
              style={{ marginLeft: 4 }}
            />
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoBox}>
              <MaterialIcons
                name="local-gas-station"
                size={20}
                color={theme.text}
              />
              <Text style={[styles.infoText, { color: theme.text }]}>₦{station.price || 0}</Text>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Rate</Text>
            </View>
            <View style={styles.infoBox}>
              <MaterialIcons name="near-me" size={20} color={theme.text} />
              <Text style={[styles.infoText, { color: theme.text }]}>
                {station.distance?.toFixed(2)} km
              </Text>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Distance</Text>
            </View>
            <View style={styles.infoBox}>
              <MaterialIcons name="schedule" size={20} color={theme.text} />
              <Text style={[styles.infoText, { color: theme.text }]}>
                {estimateDeliveryTime(station.distance)} min
              </Text>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Delivery</Text>
            </View>
          </View>

          <Animated.View style={{ opacity: buttonOpacity }}>
            <TouchableOpacity style={[styles.confirmButton, { backgroundColor: theme.quaternary }]} onPress={onConfirm}>
              <Text style={styles.confirmText}>Confirm Station</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modalize>
    );
  }
);

export default StationDetailsModal;

const styles = StyleSheet.create({
  image: { width: "100%", height: 180, borderRadius: 15, marginBottom: 15 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  name: { fontSize: 18, fontWeight: "700" },
  addressRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  address: { fontSize: 14 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoBox: { alignItems: "center" },
  infoText: { fontWeight: "600", fontSize: 16 },
  infoLabel: { fontSize: 12 },
  confirmButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});