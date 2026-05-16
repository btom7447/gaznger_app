import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { ScreenContainer, ScreenHeader } from "@/components/ui/primitives";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

/**
 * Shared SupportHub — surfaces customer-care phone, email, live-chat,
 * and FAQ. Same UI for customer, vendor, and rider; copy + FAQ come
 * from `GET /api/support-info?role=` so admin web can edit per-role
 * without a mobile release.
 *
 * Routes:
 *   tel:/mailto: links via Linking.openURL
 *   Live chat → /(screens)/chat-thread with the synthetic Support thread
 *   FAQ entries expand inline; only one open at a time
 */

interface FaqRow {
  q: string;
  a: string;
}

interface SupportBlock {
  phone: string;
  email: string;
  hours: string;
  liveChatEnabled: boolean;
  faqs: FaqRow[];
}

interface SupportApiResponse {
  role: "customer" | "vendor" | "rider";
  support: SupportBlock;
}

/**
 * Per-role fallback for when the server hasn't been configured yet.
 * Empty contact fields hide the corresponding row; FAQs render as-is.
 */
const FALLBACK: Record<"customer" | "vendor" | "rider", SupportBlock> = {
  customer: {
    phone: "",
    email: "",
    hours: "",
    liveChatEnabled: true,
    faqs: [
      {
        q: "How do I place a fuel order?",
        a: "Tap a fuel on the home screen, set the quantity and delivery address, pick a station, then pay. We'll match you with the closest rider in under a minute.",
      },
      {
        q: "How long does delivery take?",
        a: "Typical delivery is 30–60 minutes depending on traffic and station distance.",
      },
      {
        q: "Can I cancel an order?",
        a: "Yes — open the order from Order History and tap Cancel. Cancellation is free until a rider picks up your fuel from the station.",
      },
    ],
  },
  vendor: {
    phone: "",
    email: "",
    hours: "",
    liveChatEnabled: true,
    faqs: [
      {
        q: "How do I add a station?",
        a: "Profile → Stations → Add station. Fill in address, fuels, prices, and operating hours.",
      },
      {
        q: "How do payouts work?",
        a: "Settled wallet balance lands in your linked bank within 60 seconds of a withdrawal request.",
      },
      {
        q: "How do I invite a rider?",
        a: "Team → Invite rider. Pick the station first, then enter the rider's phone number. They're bound to that station once they sign up.",
      },
    ],
  },
  rider: {
    phone: "",
    email: "",
    hours: "",
    liveChatEnabled: true,
    faqs: [
      {
        q: "How are orders assigned to me?",
        a: "We match riders to nearby orders. Going online makes you eligible for dispatch.",
      },
      {
        q: "When do I get paid?",
        a: "Earnings settle on order delivery. Withdraw from the Wallet screen.",
      },
    ],
  },
};

export default function SupportHubScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const role = (useSessionStore((s) => s.user?.role) ?? "customer") as
    | "customer"
    | "vendor"
    | "rider";

  const [data, setData] = useState<SupportBlock>(FALLBACK[role]);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [openingChat, setOpeningChat] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<SupportApiResponse>(
          `/api/support-info?role=${role}`,
          { timeoutMs: 10_000 },
        );
        if (cancelled) return;
        // If server returns an empty FAQ list, keep the fallback FAQs
        // so the screen is never blank during early rollout.
        const incoming = res.support ?? FALLBACK[role];
        setData({
          ...incoming,
          faqs:
            incoming.faqs && incoming.faqs.length > 0
              ? incoming.faqs
              : FALLBACK[role].faqs,
        });
      } catch {
        if (!cancelled) setData(FALLBACK[role]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const handleCall = useCallback(() => {
    if (!data.phone) return;
    Linking.openURL(`tel:${data.phone}`).catch(() =>
      toast.error("Couldn't open phone dialer"),
    );
  }, [data.phone]);

  const handleEmail = useCallback(() => {
    if (!data.email) return;
    Linking.openURL(`mailto:${data.email}?subject=Gaznger%20support`).catch(
      () => toast.error("Couldn't open email"),
    );
  }, [data.email]);

  const handleLiveChat = useCallback(async () => {
    setOpeningChat(true);
    try {
      const res = await api.post<{ chat: { _id: string } }>(
        "/api/chats/support",
        {},
        { timeoutMs: 10_000 },
      );
      router.push({
        pathname: "/(screens)/chat/[id]" as never,
        params: { id: res.chat._id } as never,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't open support chat");
    } finally {
      setOpeningChat(false);
    }
  }, [router]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <ScreenHeader title="Help & support" onBack={() => router.back()} />
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Get help</Text>

        <View style={styles.list}>
          {data.liveChatEnabled ? (
            <SupportRow
              icon="chatbubbles"
              tone="primary"
              title="Live chat"
              sub={
                data.hours
                  ? `Reply usually within minutes · ${data.hours}`
                  : "Reply usually within minutes"
              }
              onPress={openingChat ? undefined : handleLiveChat}
              trailing={
                openingChat ? (
                  <ActivityIndicator color={theme.primary} />
                ) : undefined
              }
            />
          ) : null}
          {data.phone ? (
            <SupportRow
              icon="call"
              tone="info"
              title="Call support"
              sub={data.phone}
              onPress={handleCall}
            />
          ) : null}
          {data.email ? (
            <SupportRow
              icon="mail"
              tone="info"
              title="Email support"
              sub={data.email}
              onPress={handleEmail}
            />
          ) : null}
          {!data.liveChatEnabled && !data.phone && !data.email && !loading ? (
            <Text style={styles.empty}>
              Support channels aren't configured yet.
            </Text>
          ) : null}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
          Common questions
        </Text>
        <View style={styles.faqCard}>
          {data.faqs.map((f, i) => {
            const open = openIdx === i;
            return (
              <Pressable
                key={i}
                onPress={() => setOpenIdx(open ? null : i)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={f.q}
                style={({ pressed }) => [
                  styles.faqRow,
                  i < data.faqs.length - 1 && styles.faqRowDivided,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion} numberOfLines={open ? 4 : 2}>
                    {f.q}
                  </Text>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.fgMuted}
                  />
                </View>
                {open ? (
                  <Text style={styles.faqAnswer}>{f.a}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SupportRow({
  icon,
  tone,
  title,
  sub,
  onPress,
  trailing,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tone: "primary" | "info";
  title: string;
  sub: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();
  const bg = tone === "primary" ? theme.primaryTint : theme.infoTint;
  const fg = tone === "primary" ? theme.primary : theme.info;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => [
        rowStyles.row,
        { borderColor: theme.divider, backgroundColor: theme.surface },
        !onPress && { opacity: 0.6 },
        pressed && onPress && { opacity: 0.92 },
      ]}
    >
      <View
        style={[rowStyles.iconWrap, { backgroundColor: bg }]}
      >
        <Ionicons name={icon} size={18} color={fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ ...theme.type.body, color: theme.fg, fontWeight: "700" }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{
            ...theme.type.bodySm,
            color: theme.fgMuted,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      </View>
      {trailing ?? (
        <Ionicons name="chevron-forward" size={16} color={theme.fgSubtle} />
      )}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      paddingBottom: 40,
    },
    sectionLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    list: { gap: 10 },
    empty: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    faqCard: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    faqRow: {
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    faqRowDivided: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    faqHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    faqQuestion: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    faqAnswer: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 8,
    },
  });
