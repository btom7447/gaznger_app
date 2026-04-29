import { create } from "zustand";

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  increment: () => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  increment: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  markAllRead: () => set({ unreadCount: 0 }),
}));
