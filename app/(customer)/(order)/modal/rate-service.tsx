import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface RateServiceModalProps {
  visible: boolean;
  orderId: string;
  onClose: () => void;
}

export default function RateServiceModal({ visible, orderId, onClose }: RateServiceModalProps) {
  const theme = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  const submit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/orders/${orderId}/rate`, { score: rating, comment });
      toast.success("Thanks for your feedback!");
      onClose();
    } catch {
      // Rating failure is non-critical — dismiss quietly
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const s = styles(theme);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: theme.background }]}>
          <View style={s.handle} />

          <TouchableOpacity style={s.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.icon} />
          </TouchableOpacity>

          <Text style={[s.title, { color: theme.text }]}>Rate Your Experience</Text>
          <Text style={[s.subtitle, { color: theme.icon }]}>
            How was your fuel delivery?
          </Text>

          {/* Stars */}
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={38}
                  color={star <= rating ? theme.accent : theme.ash}
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <Text style={[s.ratingLabel, { color: theme.primary }]}>{LABELS[rating]}</Text>
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
            style={[s.submitBtn, { backgroundColor: theme.primary, opacity: rating === 0 ? 0.5 : 1 }]}
            onPress={submit}
            disabled={submitting || rating === 0}
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
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.ash, marginBottom: 12,
    },
    closeIcon: {
      position: "absolute", top: 20, right: 20,
      padding: 4,
    },
    title: { fontSize: 20, fontWeight: "500", marginTop: 8, marginBottom: 6 },
    subtitle: { fontSize: 14, fontWeight: "300", marginBottom: 24 },
    starsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
    ratingLabel: { fontSize: 15, fontWeight: "400", marginBottom: 20 },
    input: {
      width: "100%",
      borderRadius: 14, borderWidth: 1,
      padding: 14, fontSize: 14, fontWeight: "300",
      minHeight: 80, marginBottom: 20,
    },
    submitBtn: {
      width: "100%", paddingVertical: 15,
      borderRadius: 16, alignItems: "center", marginBottom: 10,
    },
    submitText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    skipBtn: { paddingVertical: 8 },
    skipText: { fontSize: 14, fontWeight: "300" },
  });
