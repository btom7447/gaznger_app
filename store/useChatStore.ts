import { create } from "zustand";

/**
 * Chat store — lightweight unread counter that powers the header
 * badge on Home / Today / Orders / Profile. Server is the source of
 * truth (GET /api/chats/unread-summary); the store mirrors that
 * count so badges can update live on `chat:message` socket events
 * without re-fetching.
 *
 * Not persisted — counts are recomputed on app foreground from the
 * server. Sessions across reloads start with `unread: 0` and the
 * first fetch trues it up.
 */
interface ChatState {
  unread: number;
  setUnread: (n: number) => void;
  /** Bump unread (e.g. on chat:message arrival for a thread I'm not viewing). */
  bumpUnread: (delta?: number) => void;
  /** Decrement unread for a thread we just marked-read. */
  decrementUnread: (delta: number) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  unread: 0,
  setUnread: (n) => set({ unread: Math.max(0, n) }),
  bumpUnread: (delta = 1) =>
    set((s) => ({ unread: Math.max(0, s.unread + delta) })),
  decrementUnread: (delta) =>
    set((s) => ({ unread: Math.max(0, s.unread - delta) })),
  reset: () => set({ unread: 0 }),
}));
