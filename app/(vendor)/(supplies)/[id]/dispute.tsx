import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "sonner-native";
import {
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorPill,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * Dispute thread for a bulk purchase with variance > tolerance.
 *
 * Header shows the snapshot (loaded / offloaded / variance%). Body is
 * a chat: vendor / plant / system roles. Vendor types in the input
 * row at the bottom; messages persist server-side via
 * POST /api/vendor/bulk-purchases/:id/dispute/message.
 */

interface DisputeMessage {
  role: "vendor" | "plant" | "system";
  by?: string;
  body: string;
  attachments?: string[];
  at: string;
}

interface DisputePayload {
  _id: string;
  bulkOrder: string;
  status: "open" | "resolved" | "escalated";
  snapshot: {
    loadedQty: number;
    offloadedQty: number;
    variancePct: number;
  };
  messages: DisputeMessage[];
}

interface BulkOrderDetail {
  _id: string;
  unit: string;
  plant?: { name?: string };
  dispute?: DisputePayload | null;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function DisputeThreadScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const meId = useSessionStore((s) => s.user?.id);

  const [order, setOrder] = useState<BulkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<BulkOrderDetail>(
        `/api/vendor/bulk-purchases/${id}`,
        { timeoutMs: 10_000 },
      );
      setOrder(res);
    } catch {
      // keep prior snapshot
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const dispute = order?.dispute ?? null;

  // Scroll to bottom on dispute updates so the latest message is in view.
  useEffect(() => {
    if (!dispute) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [dispute?.messages?.length]);

  const handleSend = useCallback(async () => {
    if (!order || !draft.trim()) return;
    setSending(true);
    try {
      const res = await api.post<{ dispute: DisputePayload }>(
        `/api/vendor/bulk-purchases/${order._id}/dispute/message`,
        { body: draft.trim() },
      );
      setOrder((prev) =>
        prev ? { ...prev, dispute: res.dispute } : prev,
      );
      setDraft("");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
    } finally {
      setSending(false);
    }
  }, [order, draft]);

  return (
    <VendorScreenShell title="Dispute" hideStationSwitcher>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
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
            <Text style={styles.backText}>Back to purchase</Text>
          </Pressable>

          {loading && !order ? (
            <SkelStack gap={10}>
              <Skel height={120} radius={16} />
              <Skel height={60} radius={16} />
              <Skel height={60} radius={16} />
            </SkelStack>
          ) : !order ? (
            <VendorEmptyState
              icon="cloud-offline-outline"
              headline="Couldn't load purchase"
            />
          ) : !dispute ? (
            <VendorEmptyState
              icon="chatbubbles-outline"
              headline="No dispute thread"
              body="Open one from the reconcile screen if the variance is over tolerance."
            />
          ) : (
            <>
              {/* Snapshot header */}
              <VendorCard tone="warning">
                <View style={styles.snapHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.snapTitle}>
                      {order.plant?.name ?? "Plant"}
                    </Text>
                    <Text style={styles.snapSub}>
                      Variance over tolerance — work it out below.
                    </Text>
                  </View>
                  <VendorPill
                    tone={
                      dispute.status === "resolved"
                        ? "success"
                        : dispute.status === "escalated"
                          ? "error"
                          : "warning"
                    }
                    size="sm"
                  >
                    {dispute.status === "resolved"
                      ? "Resolved"
                      : dispute.status === "escalated"
                        ? "Escalated"
                        : "Open"}
                  </VendorPill>
                </View>
                <View style={styles.snapRow}>
                  <SnapCell
                    label="Loaded"
                    value={`${dispute.snapshot.loadedQty} ${order.unit}`}
                  />
                  <SnapCell
                    label="Offloaded"
                    value={`${dispute.snapshot.offloadedQty} ${order.unit}`}
                  />
                  <SnapCell
                    label="Variance"
                    value={`${dispute.snapshot.variancePct.toFixed(2)}%`}
                  />
                </View>
              </VendorCard>

              {/* Messages */}
              {dispute.messages.length === 0 ? (
                <Text style={styles.emptyThread}>
                  No messages yet. Send the first one to start the
                  conversation.
                </Text>
              ) : (
                <View style={styles.thread}>
                  {dispute.messages.map((m, i) => (
                    <MessageBubble
                      key={i}
                      msg={m}
                      isMine={m.role === "vendor" && m.by === meId}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {dispute && dispute.status === "open" ? (
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Type a message…"
              placeholderTextColor={theme.fgMuted}
              value={draft}
              onChangeText={setDraft}
              multiline
              accessibilityLabel="Message draft"
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={({ pressed }) => [
                styles.sendBtn,
                (!draft.trim() || sending) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="send" size={18} color={theme.fgOnPrimary} />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </VendorScreenShell>
  );
}

function SnapCell({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text
        style={{
          ...theme.type.body,
          color: theme.fg,
          fontWeight: "800",
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          ...theme.type.caption,
          color: theme.fgMuted,
          fontWeight: "600",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MessageBubble({
  msg,
  isMine,
}: {
  msg: DisputeMessage;
  isMine: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeBubbleStyles(theme), [theme]);
  if (msg.role === "system") {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{msg.body}</Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.row,
        { justifyContent: isMine ? "flex-end" : "flex-start" },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        {!isMine ? (
          <Text style={styles.roleLabel}>
            {msg.role === "plant" ? "Plant" : "Vendor"}
          </Text>
        ) : null}
        <Text style={[styles.body, isMine && { color: theme.fgOnPrimary }]}>
          {msg.body}
        </Text>
        <Text style={[styles.time, isMine && { color: theme.fgOnPrimary }]}>
          {fmtTime(msg.at)}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      paddingBottom: 24,
      gap: 14,
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
    snapHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    snapTitle: {
      ...theme.type.h2,
      color: theme.fg,
    },
    snapSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 2,
    },
    snapRow: {
      flexDirection: "row",
    },
    thread: {
      gap: 10,
    },
    emptyThread: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
      paddingVertical: 24,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 20,
      backgroundColor: theme.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    input: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      backgroundColor: theme.bgMuted,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.radius.lg,
      maxHeight: 120,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });

const makeBubbleStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    row: { flexDirection: "row" },
    bubble: {
      maxWidth: "85%",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.radius.lg,
      gap: 2,
    },
    bubbleMine: {
      backgroundColor: theme.primary,
      borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
      backgroundColor: theme.bgMuted,
      borderBottomLeftRadius: 4,
    },
    roleLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    body: {
      ...theme.type.body,
      color: theme.fg,
    },
    time: {
      ...theme.type.caption,
      color: theme.fgMuted,
      marginTop: 2,
      alignSelf: "flex-end",
    },
    systemRow: {
      alignItems: "center",
      paddingVertical: 6,
    },
    systemText: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontStyle: "italic",
    },
  });
