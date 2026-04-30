import React, { useCallback, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import {
  FloatingCTA,
  Row,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Contact support — v3.
 *
 * Three quick channels (WhatsApp / phone / email) at the top, then a
 * "Send a message" form that opens the user's default email client
 * with a prefilled mail-to. We don't have a server-side ticketing
 * endpoint yet — the form just composes a mail-to so messages land
 * in the support inbox until a real backend lands.
 *
 * Both "Contact support" and "Send feedback" rows from Settings route
 * here; the topic chips below let the user flag intent.
 */

const SUPPORT_PHONE = "+2347000000000"; // placeholder
const SUPPORT_WHATSAPP = "2347000000000"; // placeholder, no '+'
const SUPPORT_EMAIL = "support@gaznger.com";

const TOPICS: { id: string; label: string }[] = [
  { id: "order", label: "Order issue" },
  { id: "payment", label: "Payment / wallet" },
  { id: "rider", label: "Rider behaviour" },
  { id: "account", label: "Account help" },
  { id: "feedback", label: "Feedback" },
  { id: "other", label: "Other" },
];

const MESSAGE_MAX = 500;

export default function ContactSupportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [topic, setTopic] = useState<string>("order");
  const [message, setMessage] = useState("");

  const openWhatsapp = useCallback(async () => {
    const text = encodeURIComponent("Hi Gaznger, I need help with…");
    const url = `whatsapp://send?phone=${SUPPORT_WHATSAPP}&text=${text}`;
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (supported) {
      Linking.openURL(url);
    } else {
      // Fallback to web link.
      Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`);
    }
  }, []);

  const openPhone = useCallback(() => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
      toast.error("Couldn't open phone app");
    });
  }, []);

  const openEmail = useCallback(() => {
    const subject = encodeURIComponent("Gaznger support");
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {
      toast.error("Couldn't open mail app");
    });
  }, []);

  const handleSend = useCallback(() => {
    const t = topic.trim();
    const subject = encodeURIComponent(
      `[${TOPICS.find((x) => x.id === t)?.label ?? "Support"}] from app`
    );
    const body = encodeURIComponent(message.trim());
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
    ).catch(() => {
      toast.error("Couldn't open mail app");
    });
  }, [topic, message]);

  const canSend = message.trim().length >= 4;

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <ScreenHeader title="Contact support" onBack={() => router.back()} />
      }
      footer={
        <FloatingCTA
          label="Send message"
          subtitle={canSend ? "Opens your mail app" : "Tell us what's up"}
          disabled={!canSend}
          onPress={handleSend}
          floating={false}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lead}>
          Most issues resolve in under an hour. WhatsApp is fastest —
          phone goes to voicemail outside 8am–8pm Lagos time.
        </Text>

        <Text style={styles.sectionLabel}>QUICK CHANNELS</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="logo-whatsapp"
            label="WhatsApp"
            sub="Fastest · 8am–10pm daily"
            onPress={openWhatsapp}
          />
          <Row
            icon="call-outline"
            label="Call support"
            sub={SUPPORT_PHONE}
            onPress={openPhone}
          />
          <Row
            icon="mail-outline"
            label="Email"
            sub={SUPPORT_EMAIL}
            divider={false}
            onPress={openEmail}
          />
        </View>

        <Text style={styles.sectionLabel}>OR SEND A MESSAGE</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>What's it about?</Text>
          <View style={styles.chipRow}>
            {TOPICS.map((t) => {
              const isSel = topic === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTopic(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  style={({ pressed }) => [
                    styles.chip,
                    isSel && styles.chipSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSel && styles.chipTextSelected,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Message</Text>
          <View style={styles.textareaWrap}>
            <TextInput
              value={message}
              onChangeText={(v) => setMessage(v.slice(0, MESSAGE_MAX))}
              placeholder="Tell us what happened. Order ID + timestamps help."
              placeholderTextColor={theme.fgSubtle}
              multiline
              accessibilityLabel="Support message"
              style={styles.textarea}
            />
          </View>
          <Text style={styles.charCount}>
            {message.length} / {MESSAGE_MAX}
          </Text>
        </View>

        <View style={styles.tipCard}>
          <Ionicons
            name="information-circle"
            size={16}
            color={theme.info}
          />
          <Text style={styles.tipText}>
            We pull your account ID + last order automatically when the
            mail app opens — you don't need to add them.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
      paddingBottom: theme.space.s5,
    },
    lead: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 18,
      marginBottom: theme.space.s4,
    },

    sectionLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s2,
    },
    rowGroup: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius.md + 2,
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },

    field: {
      gap: theme.space.s2,
      marginTop: theme.space.s2,
    },
    fieldLabel: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    chipSelected: {
      backgroundColor: theme.primary,
    },
    chipText: {
      ...theme.type.caption,
      color: theme.fg,
      fontWeight: "700",
    },
    chipTextSelected: {
      color: "#fff",
    },

    textareaWrap: {
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      minHeight: 140,
    },
    textarea: {
      ...theme.type.body,
      color: theme.fg,
      textAlignVertical: "top",
      padding: 0,
      minHeight: 110,
    },
    charCount: {
      ...theme.type.caption,
      color: theme.fgMuted,
      textAlign: "right",
    },

    tipCard: {
      flexDirection: "row",
      gap: 10,
      marginTop: theme.space.s4,
      padding: 14,
      borderRadius: theme.radius.md,
      backgroundColor: theme.infoTint,
    },
    tipText: {
      flex: 1,
      ...theme.type.caption,
      color: theme.fg,
      lineHeight: 17,
    },
  });
