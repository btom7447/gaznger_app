import React, { useMemo, useState } from "react";
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
  Row,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Help & support — v3.
 *
 * Layout:
 *   1. Search field — filters the FAQ accordion below.
 *   2. Quick topic cards (4 large tile shortcuts to common help routes).
 *   3. FAQ accordion grouped under "Common questions".
 *   4. Footer row → Contact support (route: /(screens)/contact-support).
 *
 * No server fetch — FAQ content is static. The accordion is driven by
 * a single open-index, not LayoutAnimation, so it works the same on
 * iOS + Android without `setLayoutAnimationEnabledExperimental`.
 */

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How do I place a fuel order?",
    a: "Tap a fuel on the home screen, set the quantity and delivery address, pick a station, then pay. We'll match you with the closest rider in under a minute.",
  },
  {
    q: "How long does delivery take?",
    a: "Typical delivery is 30–60 minutes depending on traffic and station distance. The Track screen shows a live ETA the moment a rider is matched.",
  },
  {
    q: "Can I cancel an order?",
    a: "Yes — open the order from Order History and tap Cancel. Cancellation is free until a rider picks up your fuel from the station.",
  },
  {
    q: "How do Gaznger Points work?",
    a: "You earn 50–200 points per delivered order. 1 point = ₦1 off any future order. Apply them on the Payment screen, or flip on Auto-redeem in Settings.",
  },
  {
    q: "What payment methods are accepted?",
    a: "Cards (saved or one-off via Paystack), the Gaznger wallet, and bank transfer. Cash on delivery isn't supported — every order needs an audit trail.",
  },
  {
    q: "Why is my wallet balance pending?",
    a: "Top-ups settle instantly. Refunds and earnings sit in pending until the order closes (delivery confirmed + 24-hour dispute window).",
  },
  {
    q: "How do I update my saved card?",
    a: "Tap any payment method in Settings → Payment methods. We don't store your card — Paystack does — so removing means re-entering on next checkout.",
  },
  {
    q: "Is the LPG cylinder I receive new?",
    a: "We swap your empty for a refilled, weighed cylinder of the same brand from a verified depot. We don't sell brand-new cylinders.",
  },
];

const QUICK_TOPICS: Array<{
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
}> = [
  {
    id: "order",
    label: "Order help",
    icon: "flame-outline",
    route: "/(customer)/(order)/history",
  },
  {
    id: "wallet",
    label: "Wallet & payment",
    icon: "wallet-outline",
    route: "/(customer)/wallet",
  },
  {
    id: "points",
    label: "Points",
    icon: "star-outline",
    route: "/(screens)/points",
  },
  {
    id: "account",
    label: "Account",
    icon: "person-outline",
    route: "/(screens)/personal-info",
  },
];

export default function HelpSupportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [query, setQuery] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const visibleFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS.map((f, i) => ({ ...f, originalIdx: i }));
    return FAQS.map((f, i) => ({ ...f, originalIdx: i })).filter(
      (f) =>
        f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <ScreenHeader title="Help & support" onBack={() => router.back()} />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={theme.fgMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search articles"
            placeholderTextColor={theme.fgSubtle}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={theme.fgMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Quick topics — only shown when not searching. Sits at the
            top so the most-visited paths are reachable in one tap. */}
        {!query ? (
          <>
            <Text style={styles.sectionLabel}>QUICK TOPICS</Text>
            <View style={styles.topicGrid}>
              {QUICK_TOPICS.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(t.route as never)}
                  accessibilityRole="button"
                  accessibilityLabel={t.label}
                  style={({ pressed }) => [
                    styles.topicCard,
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <View style={styles.topicIconTile}>
                    <Ionicons
                      name={t.icon}
                      size={18}
                      color={
                        theme.mode === "dark"
                          ? "#fff"
                          : theme.palette.green700
                      }
                    />
                  </View>
                  <Text style={styles.topicLabel}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* Talk to us — escalation channels. Moved ABOVE Common
            Questions per UX direction so users who already know they
            need to contact someone don't have to scroll past the FAQ
            to find the channels. */}
        {!query ? (
          <>
            <Text style={styles.sectionLabel}>TALK TO US</Text>
            <View style={styles.rowGroup}>
              <Row
                icon="chatbubble-ellipses-outline"
                label="Live chat"
                sub="Coming soon · for now use WhatsApp"
                onPress={() =>
                  toast.info("Live chat is on the way", {
                    description:
                      "We're shipping in-app chat soon. WhatsApp is the fastest channel for now.",
                  })
                }
              />
              <Row
                icon="logo-whatsapp"
                label="WhatsApp"
                sub="Fastest · 8am–10pm daily"
                onPress={() => {
                  const text = encodeURIComponent(
                    "Hi Gaznger, I need help with…"
                  );
                  Linking.openURL(
                    `https://wa.me/2347000000000?text=${text}`
                  ).catch(() => {});
                }}
              />
              <Row
                icon="chatbubble-outline"
                label="Contact support"
                sub="WhatsApp · phone · email"
                divider={false}
                onPress={() =>
                  router.push("/(screens)/contact-support" as never)
                }
              />
            </View>
          </>
        ) : null}

        {/* Common questions — moved to the bottom per UX direction.
            Most users solve their problem from a quick topic or by
            messaging us; the FAQ catches the tail. When the user is
            actively searching, this stays the only block visible. */}
        <Text style={styles.sectionLabel}>
          {query ? "MATCHING ARTICLES" : "COMMON QUESTIONS"}
        </Text>
        {visibleFaqs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyBody}>
              Try a different word, or contact support directly.
            </Text>
          </View>
        ) : (
          <View style={styles.faqGroup}>
            {visibleFaqs.map((f, i) => {
              const isOpen = openIdx === f.originalIdx;
              return (
                <Pressable
                  key={f.q}
                  onPress={() =>
                    setOpenIdx(isOpen ? null : f.originalIdx)
                  }
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  style={({ pressed }) => [
                    styles.faqRow,
                    i < visibleFaqs.length - 1 && styles.faqRowDivider,
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <View style={styles.faqHead}>
                    <Text style={styles.faqQ}>{f.q}</Text>
                    <Ionicons
                      name={isOpen ? "chevron-down" : "chevron-forward"}
                      size={14}
                      color={theme.fgMuted}
                    />
                  </View>
                  {isOpen ? <Text style={styles.faqA}>{f.a}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}
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

    /* Search */
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      padding: 0,
    },

    sectionLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s2,
    },

    /* Quick topic grid (2x2) */
    topicGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    topicCard: {
      width: "48%",
      flexGrow: 1,
      paddingVertical: 16,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
      gap: 10,
    },
    topicIconTile: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    topicLabel: {
      ...theme.type.body,
      fontWeight: "800",
      color: theme.fg,
    },

    /* FAQ */
    faqGroup: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },
    faqRow: {
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    faqRowDivider: {
      borderBottomColor: theme.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    faqHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    faqQ: {
      fontSize: 13.5,
      fontWeight: "700",
      color: theme.fg,
      flex: 1,
    },
    faqA: {
      fontSize: 12.5,
      color: theme.fgMuted,
      marginTop: 8,
      lineHeight: 19,
    },

    emptyWrap: {
      alignItems: "center",
      paddingVertical: 30,
    },
    emptyTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      marginBottom: 4,
    },
    emptyBody: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
    },

    /* Row group (escalation) */
    rowGroup: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius.md + 2,
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },
  });
