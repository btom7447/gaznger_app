import { router } from "expo-router";
import * as Application from "expo-application";
import { toast } from "sonner-native";
import { useSessionStore } from "@/store/useSessionStore";
import { pinnedFetch } from "@/lib/pinnedFetch";

// SECURITY A4 — fail fast on misconfigured BASE_URL in production
// builds. Silent fallback to localhost:5000 would have any prod
// install hammer dev environments, which is both a privacy leak
// (PII traveling to a dev server) and an availability bug. Dev +
// EAS preview keep the localhost default so local dev still works.
const RAW_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;
const BASE_URL = RAW_BASE_URL ?? "http://localhost:5000";
if (!__DEV__) {
  if (!RAW_BASE_URL) {
    throw new Error(
      "SECURITY A4: EXPO_PUBLIC_BASE_URL is required in production builds.",
    );
  }
  if (!RAW_BASE_URL.startsWith("https://")) {
    throw new Error(
      `SECURITY A4: EXPO_PUBLIC_BASE_URL must be HTTPS in production (got "${RAW_BASE_URL}").`,
    );
  }
}

/**
 * Compare two semver-ish version strings (e.g. "2.5.1" vs "2.4.0"). Returns
 * negative if a < b, zero if equal, positive if a > b. Treats missing segments
 * as zero. Non-numeric segments fall back to a string compare so a build label
 * like "2.5.1-beta.2" doesn't crash the comparison — it just sorts after
 * "2.5.1" for the missing/numeric parts.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] ?? "0", 10);
    const nb = parseInt(pb[i] ?? "0", 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const cmp = (pa[i] ?? "").localeCompare(pb[i] ?? "");
      if (cmp !== 0) return cmp;
      continue;
    }
    if (na !== nb) return na - nb;
  }
  return 0;
}

/**
 * Edge-state route gate — fires from any request, deduped so a burst
 * of failing requests doesn't stack a chain of route.replace calls.
 *
 * EDGE P0-5 — the dedupe USED to reset on a 1500ms timer regardless
 * of whether the destination screen had actually mounted; a second
 * 426/503 burst inside that window fired another `router.replace`
 * mid-mount, which kicked the user off the destination they were
 * still entering. We now reset only when the destination screen
 * calls `clearEdgeStateLock()` on its own mount — typically from
 * each edge-state screen's first useEffect.
 */
let edgeStateRouted = false;
function routeEdgeState(path: string) {
  if (edgeStateRouted) return;
  edgeStateRouted = true;
  router.replace(path as never);
  // No setTimeout reset — the destination screen owns the unlock
  // via `clearEdgeStateLock()`. If the destination never mounts
  // (rare; only on a hard router crash), the user can still tap
  // again because edge-state screens are reachable via navigation
  // not the gate.
}

/**
 * Called by every edge-state destination screen on mount
 * (force-update, suspended, maintenance, new-device, etc.) to
 * release the dedupe lock so a subsequent failure can route again.
 */
export function clearEdgeStateLock() {
  edgeStateRouted = false;
}

/**
 * Session-expired dedupe. Multiple in-flight authenticated requests
 * (e.g. /auth/me + /api/wallet/me + /api/orders firing on screen
 * mount) all hit 401 in parallel. Without this lock each one fires
 * its own toast + router.replace and the user sees 3 stacked
 * "Session expired" toasts. The lock fires the toast + redirect ONCE
 * for the burst, then resets.
 */
let sessionExpiredFired = false;
// Track app boot time so fireSessionExpired can be tolerant during
// the cold-start window. Stale tokens in SecureStore from a prior
// app session frequently 401 on first authenticated calls; if we
// kicked the user to welcome on those we'd punt them through full
// re-OTP for what's actually a single failed token refresh.
const apiBootedAt = Date.now();
const COLD_START_TOLERANCE_MS = 15_000;

// When the user deliberately signs out, any in-flight authenticated
// request (focus effects, polling, sockets reconnecting) can race the
// token wipe and hit 401 on stale tokens. Without this flag the user
// sees "Session expired" + a route-to-phone toast moments after the
// "Signed out" toast — confusing and wrong. The sign-out handler
// raises this for a few seconds; while it's up, 401s are swallowed.
let intentionalSignOutUntil = 0;
// EDGE P2-2 — default hold window widened from 4s to 8s. Slow
// requests at 5s+ used to surface "Session expired" right after
// "Signed out", which felt like a bug. Callers can still pass a
// custom window when they know in-flight latency.
export function beginIntentionalSignOut(holdMs = 8000) {
  intentionalSignOutUntil = Date.now() + holdMs;
}

/**
 * LOGIC P0-3 — clear both gates on successful login.
 *
 * Without this, the 5-second timer at the end of fireSessionExpired
 * (and the 4-second intentionalSignOutUntil window) deadlocks a
 * rapid logout→login cycle: a 401 during that window is silently
 * swallowed, leaving the user looking at a stale session. The
 * session store calls this on every successful `login()`.
 */
export function resetAuthGates() {
  sessionExpiredFired = false;
  intentionalSignOutUntil = 0;
}

function fireSessionExpired() {
  if (Date.now() < intentionalSignOutUntil) return;
  if (sessionExpiredFired) return;
  sessionExpiredFired = true;
  const user = useSessionStore.getState().user;
  const phone = user?.phone;
  const sinceBoot = Date.now() - apiBootedAt;
  // EDGE P1-11 — only route to PIN unlock during cold-start when the
  // user actually HAS a PIN set. First-time-launch users with a
  // stale token but no cached PIN would otherwise land on an
  // unsatisfiable unlock screen. Fall through to welcome instead.
  if (sinceBoot < COLD_START_TOLERANCE_MS && user?.hasPin) {
    router.replace("/(auth)/unlock/pin" as never);
    setTimeout(() => {
      sessionExpiredFired = false;
    }, 5000);
    return;
  }
  toast.error("Session expired", {
    description: "Please sign in again.",
  });
  if (phone) {
    router.replace({
      pathname: "/(auth)/phone" as never,
      params: { mode: "login" },
    });
  } else {
    router.replace("/(auth)/welcome" as never);
  }
  setTimeout(() => {
    sessionExpiredFired = false;
  }, 5000);
}

/**
 * Inspect every response (success OR failure) for system-level signals
 * that need a global route-out. Currently:
 *   - X-Min-Version header beyond `nativeApplicationVersion` → /states/force-update
 *
 * Per-status routing (503 maintenance, 426 force-update, 401 session-
 * expired) is handled inside the request flow because they short-
 * circuit the normal response path.
 */
function checkMinVersionHeader(res: Response) {
  const min = res.headers.get("x-min-version");
  if (!min) return;
  const current = Application.nativeApplicationVersion;
  if (!current) return;
  if (compareVersions(current, min) < 0) {
    routeEdgeState(`/(auth)/states/force-update?minVersion=${encodeURIComponent(min)}`);
  }
}

// SECURITY X2 / EDGE P3-1 — gated behind __DEV__ so prod builds
// don't leak the api host through Logcat / Xcode Console.
if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log("[api] BASE_URL =", BASE_URL);
}

/**
 * Default per-request timeout. Render free tier often takes 20-40s to wake on
 * cold start, so 25s is the floor. Pass `signal` to override; pass `timeoutMs`
 * to extend or shorten without writing your own AbortController.
 */
const DEFAULT_TIMEOUT_MS = 25_000;

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
};

// Single-flight lock: only one refresh call in flight at a time
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken, setTokens, logout } = useSessionStore.getState();
    if (!refreshToken) {
      logout();
      return false;
    }
    try {
      const refreshRes = await pinnedFetch(`${BASE_URL}/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setTokens({
          accessToken: refreshData.accessToken,
          refreshToken: refreshData.refreshToken,
        });
        return true;
      } else {
        logout();
        return false;
      }
    } catch {
      logout();
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
  retry = true
): Promise<T> {
  const { accessToken } = useSessionStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const { timeoutMs, signal: externalSignal, ...rest } = options;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(new Error("Request timed out")),
    timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort);
  }

  // SECURITY X2 / EDGE P3-1 — every per-request log behind __DEV__.
  // Prod builds don't leak URLs / timings / statuses to device logs.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[api] →", options.method ?? "GET", `${BASE_URL}${path}`);
  }
  const t0 = Date.now();
  let res: Response;
  try {
    res = await pinnedFetch(`${BASE_URL}${path}`, {
      ...rest,
      headers,
      body: options.body != null ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        "[api] ←",
        options.method ?? "GET",
        `${BASE_URL}${path}`,
        res.status,
        `${Date.now() - t0}ms`
      );
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        "[api] ✗",
        options.method ?? "GET",
        `${BASE_URL}${path}`,
        `${Date.now() - t0}ms`,
        controller.signal.aborted ? "ABORTED" : (err as Error).message
      );
    }
    if (controller.signal.aborted) {
      throw new Error("Request timed out — check your connection.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  // Always check for a min-version signal, even on 200s — server can
  // soft-warn over time before flipping to a hard 426.
  checkMinVersionHeader(res);

  // 426 Upgrade Required → hard force-update.
  if (res.status === 426) {
    const errData = await res.json().catch(() => ({})) as {
      minVersion?: string;
      message?: string;
    };
    routeEdgeState(
      `/(auth)/states/force-update${
        errData.minVersion ? `?minVersion=${encodeURIComponent(errData.minVersion)}` : ""
      }`
    );
    throw new Error(errData.message ?? "Update required.");
  }

  // 503 with code: "MAINTENANCE" → route to maintenance screen. Other
  // 503s fall through to the generic error handler below (transient
  // network blip the caller can retry).
  if (res.status === 503) {
    const errData = await res.json().catch(() => ({})) as {
      code?: string;
      message?: string;
      expectedBackAt?: string;
    };
    if (errData.code === "MAINTENANCE") {
      routeEdgeState(
        `/(auth)/states/maintenance${
          errData.expectedBackAt
            ? `?expectedBackAt=${encodeURIComponent(errData.expectedBackAt)}`
            : ""
        }`
      );
      throw new Error(errData.message ?? "Service temporarily unavailable.");
    }
  }

  // Attempt token refresh on 401. If refresh fails, surface a session-
  // expired toast then route to the welcome screen with the phone
  // pre-filled (when known) so the re-login is one tap. The single-
  // flight refreshTokens() prevents N parallel refresh calls; the
  // sessionExpiredFired guard prevents N parallel toasts after the
  // refresh fails.
  if (res.status === 401 && retry) {
    // /auth/logout is intentionally tearing the session down — a 401
    // here just means the server already considers the session gone,
    // which is the desired end state. Surfacing "Session expired" in
    // that case is misleading; the caller is about to route to
    // welcome anyway.
    if (path === "/auth/logout") {
      throw new Error("Logged out.");
    }
    // Auth endpoints can legitimately return 401 for credential
    // failures (wrong PIN, expired OTP token, etc.) — those are NOT
    // session-expired events. Don't fire the global redirect; let the
    // caller surface its own error toast. Without this, a wrong PIN
    // on /auth/login bumps the user to phone-entry with a misleading
    // "Session expired" toast instead of "Wrong PIN."
    if (path.startsWith("/auth/")) {
      const errData = (await res.json().catch(() => ({}))) as {
        message?: string;
        attemptsRemaining?: number;
        retryAfterSec?: number;
      };
      const err = new Error(errData.message ?? "Authentication failed.");
      Object.assign(err, { status: 401, ...errData });
      throw err;
    }
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, options, false);
    }
    fireSessionExpired();
    throw new Error("Session expired. Please log in again.");
  }

  // 403 with accountStatus: suspended → suspended screen. Catches the
  // case where /auth/me or any authenticated call surfaces the flip
  // mid-session.
  if (res.status === 403) {
    const errData = await res.json().catch(() => ({})) as {
      accountStatus?: string;
      reason?: string;
      message?: string;
    };
    if (errData.accountStatus === "suspended") {
      routeEdgeState(
        `/(auth)/states/suspended${
          errData.reason ? `?reason=${encodeURIComponent(errData.reason)}` : ""
        }`
      );
      throw new Error(errData.message ?? "Account suspended.");
    }
    // Other 403s fall through.
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as { message?: string; errors?: string[] };
    const detail = errData.errors?.join(", ");
    throw new Error(detail ?? errData.message ?? `Request failed (${res.status})`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

interface CallOpts {
  /** Override per-request timeout in milliseconds. */
  timeoutMs?: number;
  /** Pass an external AbortSignal to cancel the request. */
  signal?: AbortSignal;
  /**
   * Extra headers — used to pass `Idempotency-Key` to money endpoints.
   * Auth + content-type are merged in by the request wrapper.
   */
  headers?: Record<string, string>;
}

export const api = {
  get: <T = unknown>(path: string, opts: CallOpts = {}) =>
    request<T>(path, { method: "GET", ...opts }),

  post: <T = unknown>(path: string, body?: unknown, opts: CallOpts = {}) =>
    request<T>(path, { method: "POST", body, ...opts }),

  put: <T = unknown>(path: string, body?: unknown, opts: CallOpts = {}) =>
    request<T>(path, { method: "PUT", body, ...opts }),

  patch: <T = unknown>(path: string, body?: unknown, opts: CallOpts = {}) =>
    request<T>(path, { method: "PATCH", body, ...opts }),

  delete: <T = unknown>(path: string, body?: unknown, opts: CallOpts = {}) =>
    request<T>(path, { method: "DELETE", body, ...opts }),

  /** Multipart form-data upload (FormData). No Content-Type header — fetch sets it with boundary. */
  uploadForm: async <T = unknown>(path: string, formData: FormData, method: "POST" | "PATCH" = "PATCH"): Promise<T> => {
    const { accessToken } = useSessionStore.getState();
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const BASE = process.env.EXPO_PUBLIC_BASE_URL ?? "http://localhost:5000";
    const res = await pinnedFetch(`${BASE}${path}`, { method, headers, body: formData });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(errData.message ?? `Upload failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  },
};
