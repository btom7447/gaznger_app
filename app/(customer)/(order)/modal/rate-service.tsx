import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface RateServiceModalProps {
  visible: boolean;
  orderId: string;
  riderId?: string | null;
  onClose: () => void;
}

function StarRow({
  label,
  rating,
  onRate,
  theme,
}: {
  label: string;
  rating: number;
  onRate: (n: number) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={srStyles.wrap}>
      <Text style={[srStyles.label, { color: theme.icon }]}>{label}</Text>
      <View style={srStyles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => onRate(star)} activeOpacity={0.7}>
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={32}
              color={star <= rating ? theme.accent : theme.ash}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

const srStyles = StyleSheet.create({
  wrap: { width: "100%", gap: 6, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  stars: { flexDirection: "row", gap: 8 },
});

export default function RateServiceModal({ visible, orderId, riderId, onClose }: RateServiceModalProps) {
  const theme = useTheme();
  const [stationRating, setStationRating] = useState(0);
  const [riderRating, setRiderRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = stationRating > 0;

  const submit = async () => {
    if (!canSubmit) {
      toast.error("Please rate the station");
      return;
    }
    setSubmitting(true);
    try {
      // Rate station (required)
      await api.post(`/api/orders/${orderId}/rate`, { score: stationRating, comment });

      // Rate rider (optional, fire-and-forget)
      if (riderId && riderRating > 0) {
        api.post(`/api/rider/rate/${riderId}`, { orderId, score: riderRating }).catch(() => {});
      }

      toast.success("Thanks for your feedback!");
      onClose();
    } catch {
      onClose(); // non-critical — dismiss quietly
    } finally {
      setSubmitting(false);
    }
  };

  const s = styles(theme);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: theme.background }]}>
          <View style={[s.handle, { backgroundColor: theme.ash }]} />

          <TouchableOpacity style={s.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.icon} />
          </TouchableOpacity>

          <Text style={[s.title, { color: theme.text }]}>Rate Your Experience</Text>
          <Text style={[s.subtitle, { color: theme.icon }]}>How was your fuel delivery?</Text>

          <ScrollView style={{ width: "100%" }} showsVerticalScrollIndicator={false}>
            {/* Station rating */}
            <View style={[s.section, { borderColor: theme.ash }]}>
              <View style={s.sectionHeader}>
                <Ionicons name="storefront-outline" size={16} color={theme.primary} />
                <Text style={[s.sectionTitle, { color: theme.text }]}>Gas Station</Text>
              </View>
              <StarRow label="How was the station?" rating={stationRating} onRate={setStationRating} theme={theme} />
              {stationRating > 0 && (
                <Text style={[s.ratingLabel, { color: theme.primary }]}>{LABELS[stationRating]}</Text>
              )}
            </View>

            {/* Rider rating (only if riderId provided) */}
            {riderId && (
              <View style={[s.section, { borderColor: theme.ash }]}>
                <View style={s.sectionHeader}>
                  <Ionicons name="bicycle-outline" size={16} color={theme.primary} />
                  <Text style={[s.sectionTitle, { color: theme.text }]}>Delivery Rider</Text>
                </View>
                <StarRow label="How was the rider?" rating={riderRating} onRate={setRiderRating} theme={theme} />
                {riderRating > 0 && (
                  <Text style={[s.ratingLabel, { color: theme.primary }]}>{LABELS[riderRating]}</Text>
                )}
              </View>
            )}

            {/* Comment */}
            <TextInput
              style={[s.input, { backgroundColor: theme.surface, borderColor: theme.ash, color: theme.text }]}
              placeholder="Add a comment (optional)"
              placeholderTextColor={theme.icon}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              selectionColor={theme.primary}
            />

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: theme.primary, opacity: canSubmit ? 1 : 0.5 }]}
              onPress={submit}
              disabled={submitting || !canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitText}>Submit Rating</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.skipBtn} onPress={onClose}>
              <Text style={[s.skipText, { color: theme.icon }]}>Skip for now</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 36,
      alignItems: "center",
      maxHeight: "85%",
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      marginBottom: 12,
    },
    closeIcon: {
      position: "absolute", top: 20, right: 20,
      padding: 4,
    },
    title: { fontSize: 20, fontWeight: "500", marginTop: 8, marginBottom: 4 },
    subtitle: { fontSize: 14, fontWeight: "300", marginBottom: 16 },

    section: {
      width: "100%", borderWidth: 1,
      borderRadius: 16, padding: 14, marginBottom: 12, gap: 8,
    },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: { fontSize: 14, fontWeight: "600" },
    ratingLabel: { fontSize: 13, fontWeight: "400" },

    input: {
      width: "100%",
      borderRadius: 14, borderWidth: 1,
      padding: 14, fontSize: 14, fontWeight: "300",
      minHeight: 80, marginBottom: 16,
    },
    submitBtn: {
      width: "100%", paddingVertical: 15,
      borderRadius: 16, alignItems: "center", marginBottom: 10,
    },
    submitText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    skipBtn: { paddingVertical: 8, alignItems: "center" },
    skipText: { fontSize: 14, fontWeight: "300" },
  });
