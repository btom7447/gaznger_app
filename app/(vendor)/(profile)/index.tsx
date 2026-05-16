import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { toast } from "sonner-native";
import {
  Skel,
  SkelStack,
  VendorCard,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useSessionStore } from "@/store/useSessionStore";
import {
  useVendorStationStore,
  type VendorStationLite,
} from "@/store/useVendorStationStore";
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { beginIntentionalSignOut } from "@/lib/api";

interface ProfileApiStation {
  _id: string;
  name: string;
}

interface ProfileApiResponse {
  user: {
    displayName?: string;
    phone?: string;
    email?: string;
    profileImage?: string;
    vendorVerification?: { status?: string; expiresAt?: string };
    partnerBadge?: { active?: boolean };
  };
  stations: ProfileApiStation[];
  rating?: { avg: number; count: number };
}

interface TankApiRow {
  _id: string;
  capacity: number;
  currentLevel: number;
  lowThresholdPct: number;
  fuelType?: { name?: string };
}

interface WalletApiResp {
  available: number;
  nextPayoutLabel?: string;
}

function fmtNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function VendorProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const sessionLogout = useSessionStore((s) => s.logout);
  const setStations = useVendorStationStore((s) => s.setStations);
  const cachedStations = useVendorStationStore((s) => s.stations);

  const [profile, setProfile] = useState<ProfileApiResponse | null>(null);
  const [tanks, setTanks] = useState<TankApiRow[] | null>(null);
  const [wallet, setWallet] = useState<WalletApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchAll = useCallback(async () => {
    try {
      const [p, k, w] = await Promise.allSettled([
        api.get<ProfileApiResponse>("/api/vendor/profile", {
          timeoutMs: 10_000,
        }),
        api.get<{ tanks: TankApiRow[] }>("/api/vendor/tanks", {
          timeoutMs: 10_000,
        }),
        api.get<WalletApiResp>("/api/vendor/wallet", { timeoutMs: 10_000 }),
      ]);
      if (p.status === "fulfilled") {
        setProfile(p.value);
        const list: VendorStationLite[] = (p.value.stations ?? []).map((s) => ({
          id: s._id,
          name: s.name,
        }));
        setStations(list);
      }
      if (k.status === "fulfilled") setTanks(k.value.tanks ?? []);
      if (w.status === "fulfilled") setWallet(w.value);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setStations]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const handleLogout = useCallback(async () => {
    beginIntentionalSignOut();
    try {
      await api.post("/auth/logout").catch(() => {});
    } finally {
      sessionLogout();
      router.replace("/(auth)/welcome" as never);
      toast.success("Signed out");
    }
  }, [router, sessionLogout]);

  // Tank summary subtitle: "Petrol 18% · Diesel 64% · LPG 42%"
  const tankSummary = useMemo(() => {
    if (!tanks || tanks.length === 0) return "Set up tanks";
    return tanks
      .slice(0, 3)
      .map((t) => {
        const pct = Math.round((t.currentLevel / t.capacity) * 100);
        return `${t.fuelType?.name ?? "Tank"} ${pct}%`;
      })
      .join(" · ");
  }, [tanks]);

  const stationCount = profile?.stations.length ?? cachedStations.length;
  const verification = profile?.user.vendorVerification;
  const verified = verification?.status === "verified";
  const partner = profile?.user.partnerBadge?.active === true;
  const displayName = profile?.user.displayName ?? user?.displayName ?? "Vendor";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <VendorScreenShell
      title="Profile"
      rightSlot={
        <Pressable
          onPress={() =>
            router.push("/(screens)/notifications-customer" as never)
          }
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={6}
          style={({ pressed }) => [
            styles.headerIconBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons
            name="notifications-outline"
            size={20}
            color={theme.fg}
          />
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        {loading && !profile ? (
          <Skel height={92} radius={16} />
        ) : (
          <VendorCard>
            <View style={styles.identityRow}>
              <View style={styles.brandTile}>
                {profile?.user.profileImage ? (
                  <Image
                    source={{ uri: profile.user.profileImage }}
                    style={styles.brandImage}
                  />
                ) : (
                  <Text style={styles.brandText}>{initials}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {verified ? (
                    <Ionicons
                      name="shield-checkmark"
                      size={14}
                      color={theme.success}
                    />
                  ) : null}
                </View>
                <Text style={styles.sub} numberOfLines={1}>
                  {stationCount} station{stationCount === 1 ? "" : "s"}
                  {verified ? " · Verified" : ""}
                  {profile?.rating
                    ? ` · ★ ${profile.rating.avg.toFixed(1)} (${profile.rating.count})`
                    : ""}
                </Text>
              </View>
            </View>
          </VendorCard>
        )}

        {loading && !profile ? (
          <SkelStack gap={10}>
            <Skel height={70} radius={16} />
            <Skel height={70} radius={16} />
            <Skel height={70} radius={16} />
            <Skel height={70} radius={16} />
          </SkelStack>
        ) : (
          <VendorCard noPadding>
            <ListRow
              icon="create"
              tone="primary"
              label="Edit station"
              sub="Hours, fuels, prices, photos"
              onPress={() =>
                router.push("/(vendor)/(profile)/stations" as never)
              }
            />
            <ListRow
              icon="speedometer"
              tone="primary"
              label="Tank levels"
              sub={tankSummary}
              onPress={() =>
                router.push("/(vendor)/(profile)/tanks" as never)
              }
            />
            <ListRow
              icon="people"
              tone="primary"
              label="Team"
              sub="Riders + invites"
              onPress={() =>
                router.push("/(vendor)/(profile)/team" as never)
              }
            />
            <ListRow
              icon="ribbon"
              tone="gold"
              label="Partner programme"
              sub={partner ? "Enrolled" : "Not enrolled — boost placement"}
            />
            <ListRow
              icon="shield-checkmark"
              tone="success"
              label="NMDPRA verification"
              sub={
                verified
                  ? `Verified${
                      verification?.expiresAt
                        ? ` · expires ${fmtDate(verification.expiresAt)}`
                        : ""
                    }`
                  : verification?.status === "pending"
                    ? "Under review"
                    : "Not verified"
              }
            />
            <ListRow
              icon="flash"
              tone="primary"
              label="Wallet & payouts"
              sub={
                wallet
                  ? `${fmtNaira(wallet.available)} available${
                      wallet.nextPayoutLabel
                        ? ` · next payout ${wallet.nextPayoutLabel.toLowerCase()}`
                        : ""
                    }`
                  : "View balance"
              }
              onPress={() => router.push("/(vendor)/(finance)" as never)}
            />
            <ListRow
              icon="person"
              tone="primary"
              label="Account"
              sub={`Owner · ${profile?.user.phone ?? user?.phone ?? ""}`}
              onPress={() =>
                router.push("/(screens)/personal-info" as never)
              }
              last
            />
          </VendorCard>
        )}

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          hitSlop={6}
          style={({ pressed }) => [
            styles.signOutBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </VendorScreenShell>
  );
}

function ListRow({
  icon,
  tone,
  label,
  sub,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "success" | "gold" | "muted";
  label: string;
  sub?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  const palette = (() => {
    if (tone === "gold") {
      return { bg: theme.palette.gold50, fg: theme.palette.gold700 };
    }
    if (tone === "success") {
      return { bg: theme.successTint, fg: theme.success };
    }
    if (tone === "muted") {
      return { bg: theme.bgMuted, fg: theme.fgMuted };
    }
    return { bg: theme.primaryTint, fg: theme.primary };
  })();

  const body = (
    <>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={palette.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            ...theme.type.body,
            color: theme.fg,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {sub ? (
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
        ) : null}
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={14} color={theme.fgMuted} />
      ) : null}
    </>
  );

  const rowStyle: any = {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [rowStyle, pressed && { opacity: 0.92 }]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{body}</View>;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 12,
      paddingBottom: 80,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bgMuted,
    },
    identityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    brandTile: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    brandImage: {
      width: 56,
      height: 56,
    },
    brandText: {
      ...theme.type.h2,
      color: theme.primary,
      fontWeight: "800",
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    name: {
      ...theme.type.h2,
      color: theme.fg,
      flexShrink: 1,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    signOutBtn: {
      alignSelf: "center",
      paddingVertical: 16,
      marginTop: 8,
    },
    signOutText: {
      ...theme.type.body,
      color: theme.error,
      fontWeight: "800",
    },
  });
