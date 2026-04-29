import { create } from "zustand";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";

/**
 * Wallet store. Single source of truth for available + pending balances
 * and the most-recent transactions. The server pushes `wallet:update`
 * whenever a charge / settle / withdraw / refund touches the user's
 * wallet — see server/socket.ts emitToUser usage.
 *
 * Roles:
 *   - Customer: top-up, spend at checkout, refund credit.
 *   - Vendor:   earnings credits, withdrawal debits.
 *   - Rider:    earnings credits, withdrawal debits.
 */

export type TransactionKind =
  | "topup_credit"
  | "order_charge_credit"
  | "order_wallet_debit"
  | "points_redeem"
  | "refund_credit"
  | "escrow_release_debit"
  | "vendor_earning_credit"
  | "rider_earning_credit"
  | "platform_commission_credit"
  | "withdraw_debit"
  | "withdraw_fee_debit"
  | "withdraw_reversal_credit"
  | "admin_adjust";

export interface WalletTransaction {
  id: string;
  amount: number; // signed NGN (positive = credit, negative = debit)
  state: "pending" | "available";
  kind: TransactionKind;
  description: string;
  order?: string | null;
  delivery?: string | null;
  withdrawal?: string | null;
  dispute?: string | null;
  createdAt: string;
}

interface WalletState {
  available: number;
  pending: number;
  currency: "NGN";
  isHydrated: boolean;
  isLoading: boolean;

  transactions: WalletTransaction[];
  txCursor: string | null;
  isLoadingTx: boolean;

  refresh: () => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  /** Wire socket subscriptions. Call once after login. */
  attachSocket: () => () => void;
  /** Local-only after a confirmed pay-with-wallet so UI feels instant. */
  applyDelta: (deltaAvailable: number, deltaPending?: number) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  available: 0,
  pending: 0,
  currency: "NGN",
  isHydrated: false,
  isLoading: false,

  transactions: [],
  txCursor: null,
  isLoadingTx: false,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<{
        available: number;
        pending: number;
        currency: "NGN";
      }>("/api/wallet/me");
      set({
        available: data.available,
        pending: data.pending,
        currency: data.currency ?? "NGN",
        isHydrated: true,
      });
    } catch {
      // Non-fatal — keep prior values
    } finally {
      set({ isLoading: false });
    }
  },

  loadMoreTransactions: async () => {
    const { txCursor, isLoadingTx, transactions } = get();
    if (isLoadingTx) return;
    set({ isLoadingTx: true });
    try {
      const qs = txCursor ? `?cursor=${encodeURIComponent(txCursor)}` : "";
      const data = await api.get<{
        transactions: WalletTransaction[];
        nextCursor: string | null;
      }>(`/api/wallet/transactions${qs}`);
      // Initial load replaces; subsequent appends.
      const merged = txCursor
        ? [...transactions, ...data.transactions]
        : data.transactions;
      set({ transactions: merged, txCursor: data.nextCursor });
    } catch {
      // Non-fatal
    } finally {
      set({ isLoadingTx: false });
    }
  },

  attachSocket: () => {
    const s = getSocket();
    if (!s) return () => {};
    const handler = (data: { available: number; pending: number }) => {
      set({ available: data.available, pending: data.pending });
      // Reset transaction cursor so the wallet screen pulls fresh on next view.
      set({ transactions: [], txCursor: null });
    };
    s.on("wallet:update", handler);
    return () => {
      s.off("wallet:update", handler);
    };
  },

  applyDelta: (deltaAvailable, deltaPending = 0) => {
    set((s) => ({
      available: Math.max(0, s.available + deltaAvailable),
      pending: Math.max(0, s.pending + deltaPending),
    }));
  },
}));
