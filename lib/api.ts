import { router } from "expo-router";
import * as Application from "expo-application";
import { toast } from "sonner-native";
import { useSessionStore } from "@/store/useSessionStore";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? "http://localhost:5000";

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
 * Reset implicitly when the router lands somewhere else and a new
 * request succeeds (a 200 doesn't go through this path).
 */
let edgeStateRouted = false;
function routeEdgeState(path: string) {
  if (edgeStateRouted) return;
  edgeStateRouted = true;
  router.replace(path as never);
  // Reset after a brief window so a recovered server can route again
  // if the user manually retries.
  setTimeout(() => {
    edgeStateRouted = false;
  }, 1500);
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
export function beginIntentionalSignOut(holdMs = 4000) {
  intentionalSignOutUntil = Date.now() + holdMs;
}

function fireSessionExpired() {
  if (Date.now() < intentionalSignOutUntil) return;
  if (sessionExpiredFired) return;
  sessionExpiredFired = true;
  const phone = useSessionStore.getState().user?.phone;
  const sinceBoot = Date.now() - apiBootedAt;
  // During the cold-start window route to PIN unlock instead of
  // welcome/phone. PIN unlock can re-mint via /auth/login with the
  // cached PIN — no full OTP round-trip needed.
  if (sinceBoot < COLD_START_TOLERANCE_MS) {
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

// DEBUG: rip out once we've confirmed the right URL is bundled.
// eslint-disable-next-line no-console
console.log("[api] BASE_URL =", BASE_URL);

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
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
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

  // DEBUG: log every request so we can see what the phone is actually hitting.
  // eslint-disable-next-line no-console
  console.log("[api] →", options.method ?? "GET", `${BASE_URL}${path}`);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers,
      body: options.body != null ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    // eslint-disable-next-line no-console
    console.log(
      "[api] ←",
      options.method ?? "GET",
      `${BASE_URL}${path}`,
      res.status,
      `${Date.now() - t0}ms`
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(
      "[api] ✗",
      options.method ?? "GET",
      `${BASE_URL}${path}`,
      `${Date.now() - t0}ms`,
      controller.signal.aborted ? "ABORTED" : (err as Error).message
    );
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
    const res = await fetch(`${BASE}${path}`, { method, headers, body: formData });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(errData.message ?? `Upload failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  },
};
