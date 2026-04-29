import { useSessionStore } from "@/store/useSessionStore";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? "http://localhost:5000";

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

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

export const api = {
  get: <T = unknown>(path: string) => request<T>(path, { method: "GET" }),

  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),

  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),

  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),

  delete: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }),

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
