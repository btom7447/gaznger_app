import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
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
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useChatStore } from "@/store/useChatStore";
import { useSessionStore } from "@/store/useSessionStore";
import BackButton from "@/components/ui/global/BackButton";

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

interface MessageRow {
  _id: string;
  chat: string;
  sender?: string;
  kind: "text" | "system";
  text: string;
  readBy?: { user: string; at: string }[];
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
    socket.on("chat:message", onIncoming);
    return () => {
      socket.off("chat:message", onIncoming);
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
    if (!text || !chatId || sending) return;
    setSending(true);
    const optimistic: MessageRow = {
      _id: `tmp-${Date.now()}`,
      chat: chatId,
      sender: meId,
      kind: "text",
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const res = await api.post<{ message: MessageRow }>(
        `/api/chats/${chatId}/messages`,
        { text },
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
    } finally {
      setSending(false);
    }
  }, [draft, chatId, sending, meId]);

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
      <View
        style={[
          styles.msgRow,
          { justifyContent: isMe ? "flex-end" : "flex-start" },
        ]}
      >
        {!isMe ? (
          <View style={styles.theirAvatar}>
            <Text style={styles.theirAvatarText}>
              {peer ? initialsFor(peer.user.displayName) : "?"}
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleThem,
          ]}
        >
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {item.text}
          </Text>
          <Text
            style={[styles.timeText, isMe && styles.timeTextMe]}
            numberOfLines={1}
          >
            {fmtTime(item.createdAt)}
            {isMe ? " · sent" : ""}
          </Text>
        </View>
      </View>
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

        <View style={styles.composer}>
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
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={({ pressed }) => [
              styles.sendBtn,
              (!draft.trim() || sending) && { opacity: 0.5 },
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
    empty: {
      alignItems: "center",
      paddingTop: 60,
    },
    emptyText: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
  });
