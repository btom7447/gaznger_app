import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AlertChip,
  Skel,
  SkelStack,
  VendorCard,
  VendorPill,
  type PillTone,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

type VerifStatus = "unverified" | "pending" | "verified" | "rejected";

interface VendorProfileResp {
  user: {
    vendorVerification?: {
      status?: VerifStatus;
      submittedAt?: string;
      reviewedAt?: string;
      rejectionReason?: string;
    };
  };
}

const STATUS_TONE: Record<VerifStatus, PillTone> = {
  unverified: "neutral",
  pending: "warning",
  verified: "success",
  rejected: "error",
};

const STATUS_LABEL: Record<VerifStatus, string> = {
  unverified: "Not started",
  pending: "Under review",
  verified: "Verified",
  rejected: "Rejected",
};

export default function VendorKycScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [status, setStatus] = useState<VerifStatus | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<VendorProfileResp>(
          "/api/vendor/profile",
          { timeoutMs: 10_000 },
        );
        if (cancelled) return;
        const v = res.user?.vendorVerification;
        setStatus((v?.status as VerifStatus) ?? "unverified");
        setReason(v?.rejectionReason ?? null);
      } catch {
        if (!cancelled) setStatus("unverified");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = useCallback(() => {
    router.push("/(vendor)/(profile)" as never);
  }, [router]);

  return (
    <VendorScreenShell title="Verification">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          style={({ pressed }) => [
            styles.backRow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.fgMuted} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {loading ? (
          <SkelStack gap={12}>
            <Skel height={140} radius={16} />
            <Skel height={120} radius={16} />
          </SkelStack>
        ) : (
          <>
            <VendorCard>
              <View style={styles.iconWrap}>
                <Ionicons
                  name="shield-checkmark"
                  size={28}
                  color={theme.primary}
                />
              </View>
              <Text style={styles.headline}>Get verified to withdraw</Text>
              <Text style={styles.body}>
                Paystack requires a verified business identity before we can
                send payouts to your bank.
              </Text>
              <View style={styles.statusRow}>
                <VendorPill tone={STATUS_TONE[status ?? "unverified"]} size="sm" dot>
                  {STATUS_LABEL[status ?? "unverified"]}
                </VendorPill>
              </View>
            </VendorCard>

            {status === "rejected" && reason ? (
              <AlertChip tone="error" title="Verification rejected" sub={reason} />
            ) : null}

            {status === "pending" ? (
              <AlertChip
                tone="info"
                title="Under review"
                sub="We'll notify you once your documents are reviewed."
              />
            ) : null}

            <VendorCard>
              <Text style={styles.cardLabel}>You'll need</Text>
              <Bullet text="BVN linked to your phone number" />
              <Bullet text="Government-issued ID (NIN or driver's licence)" />
              <Bullet text="Proof of address (utility bill or bank statement)" />
            </VendorCard>

            {status !== "verified" && status !== "pending" ? (
              <Pressable
                onPress={handleStart}
                accessibilityRole="button"
                accessibilityLabel="Start verification"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {status === "rejected" ? "Resubmit" : "Start verification"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </VendorScreenShell>
  );
}

function Bullet({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 4 }}>
      <Ionicons name="checkmark" size={16} color={theme.primary} style={{ marginTop: 2 }} />
      <Text style={{ ...theme.type.bodySm, color: theme.fg, flex: 1, fontWeight: "600" }}>
        {text}
      </Text>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 14,
      paddingBottom: 80,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: -4,
    },
    backText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primaryTint,
      marginBottom: 12,
    },
    headline: {
      ...theme.type.h2,
      color: theme.fg,
      fontWeight: "800",
      marginBottom: 6,
    },
    body: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    statusRow: {
      flexDirection: "row",
      marginTop: 12,
    },
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    primaryBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    primaryBtnText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
  });
