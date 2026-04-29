import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import {
  FloatingCTA,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import { useOrderStore } from "@/store/useOrderStore";
import { api } from "@/lib/api";

const SENTIMENT = ["Awful", "Bad", "Okay", "Good", "Excellent"];
const TAGS = ["Fast", "Polite", "Clean fill", "Good comms", "Right amount"];
const TIPS = [0, 200, 500, 1000, -1] as const; // -1 = Other
const NOTE_MAX = 140;

export default function RateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  const setRating = useOrderStore((s) => s.setRating);

  // Real rider name from the delivery-confirm payload — "Emeka" was
  // hard-coded before. Falls back to "your rider" if the screen is
  // ever reached without a rider in the draft (shouldn't happen in the
  // normal flow but the modal route is reachable directly).
  const riderName = draft.rider?.firstName ?? "your rider";

  const [stars, setStars] = useState<number>(0);
  const [tagsSelected, setTagsSelected] = useState<Set<string>>(new Set());
  const [tip, setTip] = useState<number>(500);
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = useCallback((t: string) => {
    setTagsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    router.replace("/(customer)/(track)/complete" as never);
  }, [router]);

  const handleSubmit = useCallback(async () => {
    if (stars === 0) return;
    if (!draft.orderId) {
      // No order id (corrupted draft) — best-effort: still navigate to
      // Complete so the user isn't trapped. Local rating not persisted.
      router.replace("/(customer)/(track)/complete" as never);
      return;
    }

    const tagsArray = Array.from(tagsSelected);
    const finalTip = tip === -1 ? 0 : Math.max(0, tip);

    // Lift to the store FIRST so Complete shows the user's choice even
    // if the network call fails (UI optimism — server is the canonical
    // record but the in-app celebration shouldn't fail with the network).
    setRating({
      stars,
      tags: tagsArray,
      tip: finalTip,
      note: note.trim() || undefined,
    });

    setSubmitting(true);
    try {
      await api.post(`/api/orders/${draft.orderId}/rate`, {
        stars,
        tags: tagsArray,
        tip: finalTip,
        note: note.trim(),
      });
    } catch (err: any) {
      // Show a non-blocking error but still continue to Complete so the
      // user isn't stuck on this screen. The local rating remains in
      // the store; admin can reconcile from the Rating doc.
      toast.error("Couldn't submit rating", {
        description: err?.message ?? "We'll save it locally for now.",
      });
    } finally {
      setSubmitting(false);
      router.replace("/(customer)/(track)/complete" as never);
    }
  }, [stars, tagsSelected, tip, note, draft.orderId, setRating, router]);

  const sentiment = stars > 0 ? SENTIMENT[stars - 1] : null;

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
    >
      <ScreenHeader
        title="How was it?"
        showBack
        onBack={handleClose}
      />

      <View style={styles.body}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(draft.rider?.initials ?? riderName.charAt(0)).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.riderName}>
            {[draft.rider?.firstName, draft.rider?.lastName]
              .filter(Boolean)
              .join(" ") || "Your rider"}
          </Text>
          <Text style={styles.riderSub}>
            {draft.qty != null && draft.unit
              ? `delivered ${draft.qty} ${draft.unit}`
              : "delivered"}
          </Text>
        </View>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => setStars((cur) => (cur === n ? 0 : n))}
              accessibilityRole="button"
              accessibilityLabel={`${n} stars`}
              hitSlop={4}
            >
              <Ionicons
                name={n <= stars ? "star" : "star-outline"}
                size={36}
                color={theme.accent}
              />
            </Pressable>
          ))}
        </View>

        {sentiment ? (
          <Text style={styles.sentiment}>{sentiment}</Text>
        ) : (
          <Text style={styles.sentimentPlaceholder}>Tap a star to rate</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHAT STOOD OUT</Text>
          <View style={styles.tagsRow}>
            {TAGS.map((t) => {
              const isSel = tagsSelected.has(t);
              return (
                <Pressable
                  key={t}
                  onPress={() => toggleTag(t)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSel }}
                  style={({ pressed }) => [
                    styles.tag,
                    isSel && styles.tagSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      { color: isSel ? theme.primary : theme.fg },
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            ADD A TIP · 100% GOES TO {riderName.toUpperCase()}
          </Text>
          <View style={styles.tipsRow}>
            {TIPS.map((t) => {
              const isSel = t === tip;
              const label = t === 0 ? "None" : t === -1 ? "Other" : `₦${t}`;
              return (
                <Pressable
                  key={`${t}`}
                  onPress={() => setTip(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSel }}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.tipCell,
                    isSel && styles.tipCellSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[
                      styles.tipText,
                      { color: isSel ? "#fff" : theme.fg },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.noteWrap}>
            <TextInput
              value={note}
              onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))}
              placeholder={`Tell ${riderName} what worked (optional)`}
              placeholderTextColor={theme.fgSubtle}
              multiline
              maxLength={NOTE_MAX}
              accessibilityLabel="Note for rider"
              style={styles.noteInput}
            />
          </View>
        </View>
      </View>

      <FloatingCTA
        label={
          tip > 0
            ? `Send rating · ${formatCurrency(tip)} tip`
            : "Send rating"
        }
        disabled={stars === 0}
        loading={submitting}
        onPress={handleSubmit}
        accessibilityHint={
          stars === 0 ? "Pick at least one star to send." : undefined
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: 140,
    },
    body: {
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s4,
      paddingTop: theme.space.s2,
    },
    profile: {
      alignItems: "center",
      gap: 6,
      marginTop: theme.space.s2,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      ...theme.type.h1,
      color: theme.primary,
      fontWeight: "800",
    },
    riderName: {
      ...theme.type.bodyLg,
      color: theme.fg,
      fontWeight: "800",
    },
    riderSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    starsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
    },
    sentiment: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      textAlign: "center",
    },
    sentimentPlaceholder: {
      ...theme.type.caption,
      color: theme.fgSubtle,
      textAlign: "center",
    },
    section: { gap: theme.space.s2 },
    sectionLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
    },
    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.s2,
    },
    tag: {
      backgroundColor: theme.bgMuted,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s3,
      paddingVertical: 6,
    },
    tagSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.palette.green200,
    },
    tagText: {
      ...theme.type.caption,
      fontWeight: "700",
    },
    tipsRow: {
      flexDirection: "row",
      gap: theme.space.s2,
    },
    tipCell: {
      flex: 1,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.pill,
    },
    tipCellSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    tipText: {
      ...theme.type.caption,
      fontWeight: "800",
    },
    noteWrap: {
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.md,
      borderColor: theme.border,
      borderWidth: 1,
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2 + 2,
    },
    noteInput: {
      ...theme.type.body,
      color: theme.fg,
      minHeight: 64,
      textAlignVertical: "top",
      padding: 0,
    },
  });
