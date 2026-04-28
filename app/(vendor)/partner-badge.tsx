import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

const PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    price: "₦15,000",
    period: "/month",
    badge: null,
  },
  {
    id: "quarterly",
    label: "Quarterly",
    price: "₦40,000",
    period: "/3 months",
    badge: "Save 11%",
  },
  {
    id: "annual",
    label: "Annual",
    price: "₦140,000",
    period: "/year",
    badge: "Best Value",
  },
];

const BENEFITS = [
  { icon: "ribbon" as const, label: "Gaznger Partner ribbon on your station card" },
  { icon: "flash"  as const, label: "Prioritised in \"Let Gaznger Decide\" auto-selections" },
  { icon: "trending-up" as const, label: "Boosted visibility in customer searches" },
  { icon: "notifications" as const, label: "Customers notified when you go online" },
  { icon: "stats-chart" as const, label: "Advanced analytics dashboard access" },
  { icon: "shield-checkmark" as const, label: "Dedicated partner support channel" },
];

function PartnerBadgeSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bg = theme.ash;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.ash }}>
        <Animated.View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, opacity: anim }} />
        <Animated.View style={{ flex: 1, height: 14, borderRadius: 6, backgroundColor: bg, opacity: anim }} />
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 16 }}>
          <Animated.View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: bg, opacity: anim }} />
          <Animated.View style={{ width: "55%", height: 20, borderRadius: 8, backgroundColor: bg, opacity: anim }} />
          <Animated.View style={{ width: "80%", height: 13, borderRadius: 6, backgroundColor: bg, opacity: anim }} />
        </View>
        {/* Benefits */}
        {[0,1,2,3,4].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Animated.View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, opacity: anim }} />
            <Animated.View style={{ flex: 1, height: 13, borderRadius: 6, backgroundColor: bg, opacity: anim }} />
          </View>
        ))}
        {/* Plan cards */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          {[0,1,2].map((i) => (
            <Animated.View key={i} style={{ flex: 1, height: 80, borderRadius: 14, backgroundColor: bg, opacity: anim }} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function PartnerBadgeScreen() {
  const theme = useTheme();
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [subscribing, setSubscribing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    api.get<{ user: { partnerBadge?: { active: boolean } } }>("/api/vendor/profile")
      .then((data) => { setIsPartner(data.user?.partnerBadge?.active === true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      await api.post("/api/vendor/partner-badge/subscribe", { plan: selectedPlan });
      toast.success("Subscription activated!", { description: "Your Gaznger Partner badge is now live." });
      router.back();
    } catch (err: any) {
      toast.error("Subscription failed", { description: err.message ?? "Please try again" });
    } finally {
      setSubscribing(false);
    }
  };

  const s = styles(theme);

  if (loading) return <PartnerBadgeSkeleton theme={theme} />;

  if (isPartner) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.header, { borderBottomColor: theme.ash }]}>
          <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { borderColor: theme.ash }]} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text }]}>Gaznger Partner</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: theme.primary + "18", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="ribbon-outline" size={52} color={theme.primary} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: theme.text, textAlign: "center" }}>You are a Gaznger Partner</Text>
          <Text style={{ fontSize: 14, color: theme.icon, textAlign: "center", lineHeight: 21 }}>
            Your Partner badge is active. You are prioritised in customer selections and enjoy all partner benefits.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, backgroundColor: theme.primary, marginTop: 8 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Got it</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.ash }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { borderColor: theme.ash }]} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Gaznger Partner</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: theme.primary }]}>
          <View style={s.ribbonWrap}>
            <Ionicons name="ribbon-outline" size={44} color="#fff" />
          </View>
          <Text style={s.heroTitle}>Gaznger Partner</Text>
          <Text style={s.heroSub}>
            Become a platform-preferred vendor. Get prioritised when customers let Gaznger choose for them.
          </Text>
        </View>

        {/* How it works */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Text style={[s.cardTitle, { color: theme.text }]}>How "Let Gaznger Decide" works</Text>
          <Text style={[s.cardBody, { color: theme.icon }]}>
            When a customer selects "Let Gaznger Decide", our algorithm automatically picks the best available station for their order. Gaznger Partners are weighted higher in this selection — giving you more orders with zero extra effort.
          </Text>
        </View>

        {/* Benefits */}
        <Text style={[s.sectionLabel, { color: theme.icon }]}>PARTNER BENEFITS</Text>
        <View style={[s.benefitsCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          {BENEFITS.map((b, i) => (
            <View
              key={i}
              style={[
                s.benefitRow,
                i < BENEFITS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.ash },
              ]}
            >
              <View style={[s.benefitIcon, { backgroundColor: theme.primary + "18" }]}>
                <Ionicons name={b.icon} size={16} color={theme.primary} />
              </View>
              <Text style={[s.benefitLabel, { color: theme.text }]}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* Plans */}
        <Text style={[s.sectionLabel, { color: theme.icon }]}>CHOOSE A PLAN</Text>
        {PLANS.map((plan) => {
          const active = selectedPlan === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                s.planCard,
                {
                  backgroundColor: active ? theme.tertiary : theme.surface,
                  borderColor: active ? theme.primary : theme.ash,
                  borderWidth: active ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <View style={s.planLabelRow}>
                  <Text style={[s.planLabel, { color: active ? theme.primary : theme.text }]}>{plan.label}</Text>
                  {plan.badge && (
                    <View style={[s.planBadge, { backgroundColor: theme.primary }]}>
                      <Text style={s.planBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                </View>
                <View style={s.planPriceRow}>
                  <Text style={[s.planPrice, { color: active ? theme.primary : theme.text }]}>{plan.price}</Text>
                  <Text style={[s.planPeriod, { color: theme.icon }]}>{plan.period}</Text>
                </View>
              </View>
              <View style={[s.planSelector, {
                borderColor: active ? theme.primary : theme.ash,
                backgroundColor: active ? theme.primary : "transparent",
              }]}>
                {active && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Disclaimer */}
        <View style={[s.disclaimer, { backgroundColor: theme.tertiary }]}>
          <Ionicons name="information-circle-outline" size={14} color={theme.primary} />
          <Text style={[s.disclaimerText, { color: theme.icon }]}>
            Subscription renews automatically. Cancel anytime from your profile. Badge is active immediately after payment.
          </Text>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={[s.ctaBar, { borderTopColor: theme.ash, backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[s.subscribeBtn, { backgroundColor: theme.primary }]}
          onPress={handleSubscribe}
          disabled={subscribing}
          activeOpacity={0.85}
        >
          {subscribing
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <MaterialCommunityIcons name="ribbon" size={18} color="#fff" />
                <Text style={s.subscribeBtnText}>Subscribe — {PLANS.find((p) => p.id === selectedPlan)?.price}</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1,
    },
    backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700" },

    scroll: { paddingBottom: 40 },

    hero: {
      alignItems: "center", paddingVertical: 32, paddingHorizontal: 24, gap: 10,
    },
    ribbonWrap: {
      width: 72, height: 72, borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    heroTitle: { fontSize: 24, fontWeight: "700", color: "#fff" },
    heroSub: { fontSize: 14, lineHeight: 22, color: "rgba(255,255,255,0.85)", textAlign: "center" },

    card: { margin: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
    cardTitle: { fontSize: 14, fontWeight: "700" },
    cardBody: { fontSize: 13, lineHeight: 20 },

    sectionLabel: {
      fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase",
      marginHorizontal: 16, marginBottom: 10, marginTop: 4,
    },

    benefitsCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    benefitIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    benefitLabel: { flex: 1, fontSize: 13 },

    planCard: {
      flexDirection: "row", alignItems: "center",
      marginHorizontal: 16, marginBottom: 10,
      borderRadius: 16, padding: 16, gap: 12,
    },
    planLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    planLabel: { fontSize: 15, fontWeight: "600" },
    planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    planBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    planPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
    planPrice: { fontSize: 20, fontWeight: "700" },
    planPeriod: { fontSize: 12 },
    planSelector: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },

    disclaimer: {
      flexDirection: "row", alignItems: "flex-start", gap: 10,
      marginHorizontal: 16, padding: 12, borderRadius: 12, marginBottom: 8,
    },
    disclaimerText: { fontSize: 12, lineHeight: 18, flex: 1 },

    ctaBar: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
    subscribeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14 },
    subscribeBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
