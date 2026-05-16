import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { toast } from "sonner-native";
import {
  RiderCard,
  Skel,
  SkelStack,
  VendorEmptyState,
  VendorPill,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface TeamApiRow {
  kind: "rider" | "invite";
  id: string;
  name: string;
  phone: string | null;
  plate: string | null;
  rating: number | null;
  trips: number;
  status: "active" | "idle" | "offline" | "pending";
  inviteId: string | null;
  invitedAt?: string;
}

export default function VendorTeamScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [team, setTeam] = useState<TeamApiRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await api.get<{ team: TeamApiRow[] }>(
        "/api/vendor/team",
        { timeoutMs: 10_000 },
      );
      setTeam(res.team ?? []);
    } catch {
      // keep prior snapshot
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTeam();
  }, [fetchTeam]);

  useFocusEffect(
    useCallback(() => {
      fetchTeam();
    }, [fetchTeam]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeam();
  }, [fetchTeam]);

  const handleInvite = useCallback(() => {
    router.push("/(vendor)/(profile)/invite" as never);
  }, [router]);

  const handleRevoke = useCallback(
    (inviteId: string, phone: string | null) => {
      Alert.alert(
        "Revoke invite?",
        phone
          ? `${phone} will no longer be able to use this invite link.`
          : "This invite will be revoked.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              try {
                await api.patch(
                  `/api/vendor/riders/invites/${inviteId}/revoke`,
                  {},
                );
                toast.success("Invite revoked");
                fetchTeam();
              } catch (err: any) {
                toast.error(err?.message ?? "Couldn't revoke");
              }
            },
          },
        ],
      );
    },
    [fetchTeam],
  );

  return (
    <VendorScreenShell
      title="Team"
      hideStationSwitcher
      rightSlot={
        <Pressable
          onPress={handleInvite}
          accessibilityRole="button"
          accessibilityLabel="Invite a rider"
          hitSlop={6}
          style={({ pressed }) => [
            styles.inviteBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="add" size={16} color={theme.fgOnPrimary} />
          <Text style={styles.inviteBtnText}>Invite</Text>
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
          <Text style={styles.backText}>Back to profile</Text>
        </Pressable>

        {loading && !team ? (
          <SkelStack gap={10}>
            <Skel height={72} radius={16} />
            <Skel height={72} radius={16} />
            <Skel height={72} radius={16} />
          </SkelStack>
        ) : !team || team.length === 0 ? (
          <VendorEmptyState
            icon="people-outline"
            headline="No riders yet"
            body="Invite a rider to start dispatching orders."
            ctaLabel="Invite a rider"
            onCta={handleInvite}
          />
        ) : (
          <View style={styles.list}>
            {team.map((row) =>
              row.kind === "rider" && row.status !== "pending" ? (
                <RiderCard
                  key={row.id}
                  id={row.id}
                  name={row.name}
                  plate={row.plate ?? undefined}
                  rating={row.rating ?? undefined}
                  trips={row.trips}
                  status={row.status as "active" | "idle" | "offline"}
                  phone={row.phone ?? undefined}
                  onSelect={() => {
                    // Tap a non-pending row: copy is built into
                    // RiderCard; tap-row is a no-op here on the team
                    // screen (no assign context).
                  }}
                />
              ) : (
                <View key={row.id} style={styles.pendingCard}>
                  <View style={styles.pendingAvatar}>
                    <Ionicons
                      name="paper-plane-outline"
                      size={18}
                      color={theme.warning}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.pendingTitleRow}>
                      <Text style={styles.pendingName} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <VendorPill tone="warning" size="sm" dot>
                        Pending
                      </VendorPill>
                    </View>
                    {row.phone ? (
                      <Text style={styles.pendingSub} numberOfLines={1}>
                        {row.phone}
                      </Text>
                    ) : null}
                  </View>
                  {row.inviteId ? (
                    <Pressable
                      onPress={() =>
                        handleRevoke(row.inviteId!, row.phone)
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Revoke invite"
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.revokeBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Ionicons
                        name="close"
                        size={16}
                        color={theme.error}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ),
            )}
          </View>
        )}
      </ScrollView>
    </VendorScreenShell>
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
    list: { gap: 10 },
    inviteBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
    },
    inviteBtnText: {
      ...theme.type.bodySm,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    pendingCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    pendingAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.warningTint,
      alignItems: "center",
      justifyContent: "center",
    },
    pendingTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pendingName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flexShrink: 1,
    },
    pendingSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    revokeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.errorTint,
      alignItems: "center",
      justifyContent: "center",
    },
  });
