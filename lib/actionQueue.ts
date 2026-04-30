/**
 * Phase 10 — offline-first action queue.
 *
 * Rider transitions and other low-cardinality state-changes are
 * enqueued here when the network is unhealthy. The queue is
 * persisted to AsyncStorage so it survives an app kill, and drained
 * on every socket reconnect or AppState foreground (whichever fires
 * first).
 *
 * Scope: rider-only for now. The customer side already converges
 * fast via the reconnect catch-up GET; the rider's CTA taps are the
 * actions that absolutely must not be lost (a "Mark at station"
 * lost while in a basement is the difference between the rider
 * getting paid for that step or not).
 *
 * Design choices:
 *   - Append-only log; entries are processed in FIFO order.
 *   - Each entry carries its own Idempotency-Key so duplicate sends
 *     after a partial drain are server-deduped (server-side cache
 *     per Phase 9).
 *   - Backoff on persistent failures: 1s, 5s, 30s, 5min, then halt
 *     + surface to user.
 *   - The optimistic UI flip (Phase 4) already happened at enqueue
 *     time. The queue is the truth-reconciliation layer.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import {
  getSocket,
  subscribeReconnect,
  subscribeSocketStatus,
  type SocketStatus,
} from "@/lib/socket";
import { newIdempotencyKey } from "@/_shared/idempotency";

const STORAGE_KEY = "gaznger:actionQueue:v1";
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [1_000, 5_000, 30_000, 5 * 60_000];

export interface QueuedAction {
  id: string;
  endpoint: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey: string;
  createdAt: number;
  attempts: number;
}

interface QueueState {
  entries: QueuedAction[];
  draining: boolean;
}

const state: QueueState = {
  entries: [],
  draining: false,
};

let hydrated = false;
let drainTimer: ReturnType<typeof setTimeout> | null = null;

type QueueListener = (entries: QueuedAction[]) => void;
const listeners = new Set<QueueListener>();

function notify() {
  const snap = state.entries.slice();
  listeners.forEach((l) => l(snap));
}

export function subscribeActionQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  // Fire current state immediately so the consumer doesn't have to
  // wait for the next change.
  listener(state.entries.slice());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Terminal-failure subscribers fire when an action exhausts its
 * retry budget (MAX_ATTEMPTS) and the queue halts at that entry.
 * Callers use this to surface a recovery UI ("sync failed, retry?")
 * — the action is still in the queue at the head; calling
 * `retryHeadOfQueue()` reschedules it.
 */
type FailureListener = (action: QueuedAction) => void;
const failureListeners = new Set<FailureListener>();

export function subscribeActionFailure(
  listener: FailureListener
): () => void {
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

function notifyFailure(action: QueuedAction): void {
  failureListeners.forEach((l) => {
    try {
      l(action);
    } catch {
      // listener errors must not break queue flow
    }
  });
}

/**
 * Manually retry the head of the queue. Resets attempts and kicks
 * a drain. Called from the recovery UI when the user taps "Retry."
 * No-op if the queue is empty.
 */
export async function retryHeadOfQueue(): Promise<void> {
  await hydrate();
  const head = state.entries[0];
  if (!head) return;
  head.attempts = 0;
  await persist();
  notify();
  drain();
}

/**
 * Drop the head of the queue (give up). Called from the recovery UI
 * when the user decides the queued action is stale and shouldn't
 * be replayed. Returns the dropped action so the caller can react
 * (e.g. revert local optimistic state).
 */
export async function dropHeadOfQueue(): Promise<QueuedAction | null> {
  await hydrate();
  const head = state.entries.shift();
  if (!head) return null;
  await persist();
  notify();
  return head;
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
  } catch {
    // Disk full / quota — non-fatal; in-memory queue is still authoritative.
  }
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QueuedAction[];
      if (Array.isArray(parsed)) {
        state.entries = parsed;
        notify();
      }
    }
  } catch {
    // corrupt storage — start fresh
  }
}

/**
 * Enqueue an action. Optimistic UI should already have flipped
 * local state; this just guarantees the request lands eventually.
 *
 * Returns the queued action so the caller can track it (e.g. clear
 * a "pending sync" indicator on success).
 */
export async function enqueueAction(input: {
  endpoint: string;
  method: QueuedAction["method"];
  body?: unknown;
}): Promise<QueuedAction> {
  await hydrate();
  const action: QueuedAction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    endpoint: input.endpoint,
    method: input.method,
    body: input.body,
    idempotencyKey: newIdempotencyKey(),
    createdAt: Date.now(),
    attempts: 0,
  };
  state.entries.push(action);
  await persist();
  notify();
  // Try to drain immediately. If offline, drain() bails fast.
  drain();
  return action;
}

async function sendOne(action: QueuedAction): Promise<boolean> {
  try {
    const headers = { "Idempotency-Key": action.idempotencyKey };
    if (action.method === "POST") {
      await api.post(action.endpoint, action.body, { headers });
    } else if (action.method === "PATCH") {
      await api.patch(action.endpoint, action.body, { headers });
    } else if (action.method === "PUT") {
      await api.put(action.endpoint, action.body, { headers });
    } else if (action.method === "DELETE") {
      await api.delete(action.endpoint, undefined, { headers });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Drain the queue. Called on every reconnect, AppState foreground,
 * and successful enqueue. Idempotent — concurrent calls are a no-op
 * because of the `draining` guard.
 */
export async function drain(): Promise<void> {
  await hydrate();
  if (state.draining || state.entries.length === 0) return;

  // Don't bother trying when the socket is offline — saves request
  // round-trips that will all fail. We still drain on subscribeReconnect
  // (which fires when status flips to live), so we won't be stuck.
  const socket = getSocket();
  if (!socket?.connected) return;

  state.draining = true;
  notify();

  while (state.entries.length > 0) {
    const action = state.entries[0];
    action.attempts += 1;
    const ok = await sendOne(action);
    if (ok) {
      state.entries.shift();
      await persist();
      notify();
      continue;
    }

    // Failure path. If we've blown past MAX_ATTEMPTS, halt the queue
    // and surface to the user. Persist the failed-but-still-queued
    // entry so it survives an app kill; the recovery UI calls
    // `retryHeadOfQueue()` or `dropHeadOfQueue()` to resolve.
    if (action.attempts >= MAX_ATTEMPTS) {
      await persist();
      notifyFailure(action);
      break;
    }
    // Schedule the next retry with backoff. Use the action's attempt
    // count to pick the delay.
    const delay = BACKOFF_MS[Math.min(action.attempts - 1, BACKOFF_MS.length - 1)];
    if (drainTimer) clearTimeout(drainTimer);
    drainTimer = setTimeout(() => {
      state.draining = false;
      drain();
    }, delay);
    state.draining = false;
    notify();
    return;
  }

  state.draining = false;
  notify();
}

/**
 * Initialize listeners. Call once at app boot (after the socket
 * helper is ready). Idempotent.
 */
let initialized = false;
export function initActionQueue(): void {
  if (initialized) return;
  initialized = true;
  hydrate();

  // Drain on every reconnect (full disconnect → reconnect cycle).
  subscribeReconnect(() => {
    drain();
  });

  // Drain when socket transitions to live from any other state. This
  // catches the FIRST connect (subscribeReconnect skips it by design).
  subscribeSocketStatus((status: SocketStatus) => {
    if (status === "live") drain();
  });
}

/**
 * Public read of the current queue length — used by the rider's
 * "N actions pending sync" indicator.
 */
export function getQueueLength(): number {
  return state.entries.length;
}

/** Read the current entries (frozen snapshot, not the live array). */
export function getQueueEntries(): QueuedAction[] {
  return state.entries.slice();
}

/**
 * Returns true when the head entry has exhausted its retry budget
 * and the queue is halted waiting on the recovery UI. Useful for
 * the "sync failed" badge.
 */
export function isQueueHalted(): boolean {
  const head = state.entries[0];
  return !!head && head.attempts >= MAX_ATTEMPTS;
}
