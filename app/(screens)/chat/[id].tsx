import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useChatStore } from "@/store/useChatStore";
import { useSessionStore } from "@/store/useSessionStore";
import BackButton from "@/components/ui/global/BackButton";
import {
  pickAndUploadChatMedia,
  type ChatMediaAttachment,
} from "@/lib/uploadChatMedia";
import { toast } from "sonner-native";

/**
 * Chat thread screen — one-to-one conversation.
 *
 * Bubble layout per design: my messages right-aligned in green; theirs
 * left-aligned in surface with a 26pt avatar disc; system messages
 * centered in a pill.
 */

interface Participant {
  user: {
    _id: string;
    displayName: string;
    profileImage?: string | null;
  };
  role: "customer" | "vendor" | "rider" | "support" | "admin";
  unread: number;
}

interface ChatResp {
  chat: {
    _id: string;
    participants: Participant[];
    orderRef?: string;
    bulkRef?: string;
  };
}

interface MessageAttachment {
  kind: "image" | "video";
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  mime?: string;
}

interface MessageRow {
  _id: string;
  chat: string;
  sender?: string;
  kind: "text" | "system";
  text: string;
  attachments?: MessageAttachment[];
  readBy?: { user: string; at: string }[];
  deletedAt?: string | null;
  createdAt: string;
}

interface MessagesResp {
  messages: MessageRow[];
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ChatThreadScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const chatId = Array.isArray(params.id) ? params.id[0] : params.id;
  const meId = useSessionStore((s) => s.user?.id);
  const decrementUnread = useChatStore((s) => s.decrementUnread);

  const [meta, setMeta] = useState<ChatResp["chat"] | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    ChatMediaAttachment[]
  >([]);
  const [picking, setPicking] = useState(false);
  const listRef = useRef<FlatList<MessageRow>>(null);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const peer = useMemo(
    () => meta?.participants.find((p) => p.user._id !== meId) ?? null,
    [meta, meId],
  );

  // Fetch thread metadata + messages.
  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    (async () => {
      try {
        const [m, msgs] = await Promise.all([
          api.get<ChatResp>(`/api/chats/${chatId}`, { timeoutMs: 10_000 }),
          api.get<MessagesResp>(`/api/chats/${chatId}/messages?limit=100`, {
            timeoutMs: 10_000,
          }),
        ]);
        if (cancelled) return;
        setMeta(m.chat);
        setMessages(msgs.messages ?? []);
        // Find my unread on this thread, then decrement the global
        // counter and mark thread read.
        const meParticipant = m.chat.participants.find(
          (p) => p.user._id === meId,
        );
        const myUnread = meParticipant?.unread ?? 0;
        if (myUnread > 0) {
          decrementUnread(myUnread);
          api
            .post(`/api/chats/${chatId}/read`)
            .catch(() => {});
        }
      } catch {
        // empty
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, meId, decrementUnread]);

  // Socket subscription for live messages on THIS thread. When a
  // message lands while the thread is open, mark it read immediately
  // so the sender's "sent" → "read" hint updates in real time.
  useEffect(() => {
    if (!chatId) return;
    const socket = getSocket();
    if (!socket) return;
    const onIncoming = (payload: {
      chatId: string;
      message: MessageRow;
    }) => {
      if (payload.chatId !== chatId) return;
      setMessages((prev) => [...prev, payload.message]);
      // If the new message wasn't from me, fire chat:read so the
      // sender sees the read receipt without the user touching
      // anything.
      if (payload.message.sender && payload.message.sender !== meId) {
        api.post(`/api/chats/${chatId}/read`).catch(() => {});
      }
    };
    const onDeleted = (payload: {
      chatId: string;
      messageId: string;
      deletedAt: string;
    }) => {
      if (payload.chatId !== chatId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === payload.messageId ? { ...m, deletedAt: payload.deletedAt } : m,
        ),
      );
    };
    socket.on("chat:message", onIncoming);
    socket.on("chat:message-deleted", onDeleted);
    return () => {
      socket.off("chat:message", onIncoming);
      socket.off("chat:message-deleted", onDeleted);
    };
  }, [chatId, meId]);

  // Auto-scroll to bottom on message arrival.
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!chatId || sending) return;
    if (!text && pendingAttachments.length === 0) return;
    setSending(true);
    const attachmentsToSend = pendingAttachments;
    const optimistic: MessageRow = {
      _id: `tmp-${Date.now()}`,
      chat: chatId,
      sender: meId,
      kind: "text",
      text,
      attachments: attachmentsToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setPendingAttachments([]);
    try {
      const res = await api.post<{ message: MessageRow }>(
        `/api/chats/${chatId}/messages`,
        { text, attachments: attachmentsToSend },
      );
      // Replace optimistic placeholder with server row (same _id from
      // the broadcast may have already landed via socket — dedupe).
      setMessages((prev) => {
        const without = prev.filter((m) => m._id !== optimistic._id);
        if (without.some((m) => m._id === res.message._id)) return without;
        return [...without, res.message];
      });
    } catch {
      // Roll back optimistic on failure.
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      setDraft(text);
      setPendingAttachments(attachmentsToSend);
    } finally {
      setSending(false);
    }
  }, [draft, chatId, sending, meId, pendingAttachments]);

  const handleAttach = useCallback(async () => {
    if (picking || sending) return;
    setPicking(true);
    try {
      const picked = await pickAndUploadChatMedia();
      if (picked.length > 0) {
        setPendingAttachments((prev) => [...prev, ...picked].slice(0, 9));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't attach media");
    } finally {
      setPicking(false);
    }
  }, [picking, sending]);

  const handleDeleteMessage = useCallback(
    (msgId: string) => {
      if (!chatId) return;
      Alert.alert(
        "Delete message?",
        "This message will be removed for everyone in this thread.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              const optimisticAt = new Date().toISOString();
              setMessages((prev) =>
                prev.map((m) =>
                  m._id === msgId ? { ...m, deletedAt: optimisticAt } : m,
                ),
              );
              try {
                await api.delete(`/api/chats/${chatId}/messages/${msgId}`);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                ).catch(() => {});
              } catch (err: any) {
                // Roll back on failure — re-fetch from server so we
                // don't show a fake tombstone.
                setMessages((prev) =>
                  prev.map((m) =>
                    m._id === msgId ? { ...m, deletedAt: null } : m,
                  ),
                );
                toast.error(err?.message ?? "Couldn't delete message");
              }
            },
          },
        ],
      );
    },
    [chatId],
  );

  const renderItem = ({ item }: { item: MessageRow }) => {
    if (item.kind === "system") {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }
    const isMe = item.sender === meId;
    return (
      <BubbleRow
        item={item}
        isMe={isMe}
        peerInitials={peer ? initialsFor(peer.user.displayName) : "?"}
        onDelete={isMe ? () => handleDeleteMessage(item._id) : undefined}
        theme={theme}
        styles={styles}
      />
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerEyebrow} numberOfLines={1}>
            {peer ? peer.role[0].toUpperCase() + peer.role.slice(1) : "Chat"}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {peer?.user.displayName ?? "Chat"}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loaded ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Say hello 👋</Text>
              </View>
            ) : null
          }
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
        />

        {pendingAttachments.length > 0 ? (
          <View style={styles.pendingStrip}>
            {pendingAttachments.map((a, i) => (
              <View key={i} style={styles.pendingThumbWrap}>
                <Image
                  source={{ uri: a.thumbUrl ?? a.url }}
                  style={styles.pendingThumb}
                />
                {a.kind === "video" ? (
                  <View style={styles.pendingVideoOverlay}>
                    <Ionicons name="play" size={12} color="#fff" />
                  </View>
                ) : null}
                <Pressable
                  onPress={() =>
                    setPendingAttachments((prev) =>
                      prev.filter((_, j) => j !== i),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Remove attachment"
                  style={styles.pendingRemove}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            onPress={handleAttach}
            disabled={picking || sending}
            accessibilityRole="button"
            accessibilityLabel="Attach photo or video"
            hitSlop={6}
            style={({ pressed }) => [
              styles.attachBtn,
              (picking || sending) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="attach" size={20} color={theme.fgMuted} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message"
            placeholderTextColor={theme.fgMuted}
            multiline
            maxLength={4000}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={handleSend}
            disabled={
              (!draft.trim() && pendingAttachments.length === 0) || sending
            }
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={({ pressed }) => [
              styles.sendBtn,
              ((!draft.trim() && pendingAttachments.length === 0) || sending) && {
                opacity: 0.5,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Single message bubble. Owns:
 *   - swipe-right gesture with haptic at the trigger threshold
 *     (visual reply scaffolding kept minimal — a haptic + spring-back
 *     is enough to confirm the gesture is wired; the quoted-reply UI
 *     lands in the next pass)
 *   - long-press to soft-delete (only for `isMe`)
 *   - attachments grid rendering
 *   - tombstone fallback when `deletedAt` is set
 */
function BubbleRow({
  item,
  isMe,
  peerInitials,
  onDelete,
  theme,
  styles,
}: {
  item: MessageRow;
  isMe: boolean;
  peerInitials: string;
  onDelete?: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const translateX = useSharedValue(0);
  const triggered = useRef(false);

  const fireHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(isMe ? -10 : 10)
        .failOffsetY([-12, 12])
        .onStart(() => {
          triggered.current = false;
        })
        .onUpdate((e) => {
          // Swipe direction depends on side: their bubble (left) drags
          // right; my bubble drags left. Resistance after the trigger.
          const raw = e.translationX;
          const clamped = isMe
            ? Math.max(-80, Math.min(0, raw))
            : Math.min(80, Math.max(0, raw));
          translateX.value = clamped;
          if (!triggered.current && Math.abs(clamped) > 60) {
            triggered.current = true;
            runOnJS(fireHaptic)();
          }
        })
        .onEnd(() => {
          translateX.value = withTiming(0, { duration: 180 });
        }),
    [isMe, fireHaptic, translateX],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const isDeleted = !!item.deletedAt;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.msgRow,
          { justifyContent: isMe ? "flex-end" : "flex-start" },
          animatedStyle,
        ]}
      >
        {!isMe ? (
          <View style={styles.theirAvatar}>
            <Text style={styles.theirAvatarText}>{peerInitials}</Text>
          </View>
        ) : null}
        <Pressable
          onLongPress={isMe && !isDeleted ? onDelete : undefined}
          delayLongPress={350}
          accessibilityRole={isMe && !isDeleted ? "button" : undefined}
          accessibilityLabel={
            isMe && !isDeleted
              ? "Long press to delete your message"
              : undefined
          }
          style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleThem,
            isDeleted && styles.bubbleDeleted,
          ]}
        >
          {isDeleted ? (
            <Text
              style={[styles.deletedText, isMe && { color: "rgba(255,255,255,0.7)" }]}
            >
              This message was deleted
            </Text>
          ) : (
            <>
              {item.attachments && item.attachments.length > 0 ? (
                <AttachmentGrid attachments={item.attachments} />
              ) : null}
              {item.text ? (
                <Text
                  style={[
                    styles.bubbleText,
                    isMe && styles.bubbleTextMe,
                    item.attachments && item.attachments.length > 0
                      ? { marginTop: 6 }
                      : null,
                  ]}
                >
                  {item.text}
                </Text>
              ) : null}
              <Text
                style={[styles.timeText, isMe && styles.timeTextMe]}
                numberOfLines={1}
              >
                {fmtTime(item.createdAt)}
                {isMe ? " · sent" : ""}
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * 3×3 grid of media thumbnails. Layout cribbed from WhatsApp:
 *   1   → 1 big tile
 *   2   → 2 side-by-side
 *   3   → 1 big + 2 stacked
 *   4   → 2×2
 *   5–9 → 3×N (3 columns, rows fill row-major)
 * Videos overlay a centered play badge on the thumb image.
 */
function AttachmentGrid({
  attachments,
}: {
  attachments: MessageAttachment[];
}) {
  const theme = useTheme();
  const visible = attachments.slice(0, 9);
  const overflow = attachments.length - visible.length;
  const count = visible.length;
  const cols = count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 2 : 3;
  const size = 200 / Math.max(cols, 2); // px per tile
  return (
    <View style={[gridStyles.wrap, count === 1 && { width: 200 }]}>
      {visible.map((a, i) => {
        const isLastWithOverflow = overflow > 0 && i === visible.length - 1;
        return (
          <View
            key={i}
            style={[
              gridStyles.tile,
              {
                width: count === 1 ? 200 : size * (cols === 2 ? 1 : 1),
                height: count === 1 ? 200 : size,
              },
            ]}
          >
            <Image
              source={{ uri: a.thumbUrl ?? a.url }}
              style={gridStyles.image}
              resizeMode="cover"
            />
            {a.kind === "video" ? (
              <View style={gridStyles.playOverlay}>
                <Ionicons name="play" size={20} color="#fff" />
              </View>
            ) : null}
            {isLastWithOverflow ? (
              <View style={gridStyles.overflowOverlay}>
                <Text style={gridStyles.overflowText}>+{overflow}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  tile: {
    backgroundColor: "rgba(0,0,0,0.2)",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  overflowOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overflowText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
  },
});

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bgMuted,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    headerEyebrow: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    headerTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    list: {
      padding: 16,
      gap: 8,
    },
    systemRow: {
      alignSelf: "center",
      backgroundColor: theme.bgMuted,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      marginVertical: 4,
    },
    systemText: {
      fontSize: 11,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    msgRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
    },
    theirAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.infoTint,
      alignItems: "center",
      justifyContent: "center",
    },
    theirAvatarText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.info,
    },
    bubble: {
      maxWidth: "78%",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
    },
    bubbleMe: {
      backgroundColor: theme.primary,
      borderBottomRightRadius: 4,
    },
    bubbleThem: {
      backgroundColor: theme.surface,
      borderBottomLeftRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    bubbleText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "500",
    },
    bubbleTextMe: {
      color: theme.fgOnPrimary,
    },
    timeText: {
      fontSize: 9.5,
      color: theme.fgMuted,
      marginTop: 4,
      textAlign: "right",
    },
    timeTextMe: {
      color: "rgba(255,255,255,0.6)",
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.bgMuted,
      ...theme.type.body,
      color: theme.fg,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    attachBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    pendingStrip: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 12,
      paddingTop: 8,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    pendingThumbWrap: {
      width: 56,
      height: 56,
      borderRadius: 8,
      overflow: "hidden",
      position: "relative",
    },
    pendingThumb: {
      width: "100%",
      height: "100%",
    },
    pendingVideoOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    pendingRemove: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },
    bubbleDeleted: {
      opacity: 0.7,
    },
    deletedText: {
      fontStyle: "italic",
      fontSize: 13,
      color: theme.fgMuted,
    },
    empty: {
      alignItems: "center",
      paddingTop: 60,
    },
    emptyText: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
  });
