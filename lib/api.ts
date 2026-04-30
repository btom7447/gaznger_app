import { useSessionStore } from "@/store/useSessionStore";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? "http://localhost:5000";

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

  // Attempt token refresh on 401
  if (res.status === 401 && retry) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, options, false);
    }
    throw new Error("Session expired. Please log in again.");
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
