import { useEffect } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { useChatStore } from "@/store/useChatStore";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/api";

/**
 * Mounted once at app root. Keeps `useChatStore.unread` honest:
 *
 *   - On login → fetch /api/chats/unread-summary as the source of truth.
 *   - On `chat:message` socket events → bump unread by 1, UNLESS the
 *     message is from me (multi-device — my own message echoes back
 *     via socket too).
 *   - On `chat:read` events → ignore for me-side counts; only matters
 *     for the read-receipt UI inside the thread screen.
 *
 * Renders nothing.
 */
export default function ChatUnreadBridge() {
  const isLoggedIn = useSessionStore((s) => s.isLoggedIn);
  const meId = useSessionStore((s) => s.user?.id);
  const setUnread = useChatStore((s) => s.setUnread);
  const bumpUnread = useChatStore((s) => s.bumpUnread);
  const resetUnread = useChatStore((s) => s.reset);

  // Initial fetch on login. Also fires on user switch.
  useEffect(() => {
    if (!isLoggedIn) {
      resetUnread();
      return;
    }
    api
      .get<{ unread: number }>("/api/chats/unread-summary", {
        timeoutMs: 8000,
      })
      .then((res) => setUnread(res.unread ?? 0))
      .catch(() => {
        /* keep prior */
      });
  }, [isLoggedIn, meId, setUnread, resetUnread]);

  // Live socket subscription.
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = getSocket();
    if (!socket) return;
    const onMessage = (payload: {
      chatId: string;
      message: { sender?: string };
    }) => {
      // Only bump unread for messages that aren't mine.
      if (payload?.message?.sender && payload.message.sender !== meId) {
        bumpUnread(1);
      }
    };
    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [isLoggedIn, meId, bumpUnread]);

  return null;
}
