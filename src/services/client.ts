// Low-level HTTP client: JWT injection, 401 -> refresh retry, friendly errors.

const TOKEN_KEY = "lc_access_token";
const REFRESH_KEY = "lc_refresh_token";

const RAW_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";
const API_BASE = `${RAW_BASE.replace(/\/$/, "")}/api/v1`;

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearAuthTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("lc_session");
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  const accessToken = getAccessToken();
  if (!refreshToken || !accessToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.errors && typeof body.errors === "object") {
      message = Object.values(body.errors as Record<string, string[]>)
        .flat()
        .join(" ");
    } else if (typeof body?.error === "string") {
      message = body.error;
    } else if (typeof body === "string") {
      message = body;
    } else if (body?.detail || body?.title) {
      message = body.detail ?? body.title;
    } else if (body?.message) {
      message = body.message;
    }
  } catch {
    /* not json */
  }
  throw new ApiError(message, res.status);
}

export interface ApiFetchOptions extends RequestInit {
  /** Skip Authorization header (public endpoints). */
  anonymous?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!options.anonymous) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry && !options.anonymous) {
    refreshPromise ??= refreshAccessToken().finally(() => (refreshPromise = null));
    const newToken = await refreshPromise;
    if (newToken) return apiFetch<T>(path, options, false);
    clearAuthTokens();
    throw new ApiError("Your session has expired. Please log in again.", 401);
  }

  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Download a file (PDF etc.) with auth header; returns blob + filename. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) await parseError(res);
  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(dispo);
  return { blob, filename: match?.[1] ?? "download.pdf" };
}

export function saveBlobAs({ blob, filename }: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:/i.test(path)) return path;
  return `${RAW_BASE.replace(/\/$/, "")}${path}`;
}

/**
 * Opens a protected media/document URL in a new tab. Fetches it with the
 * auth token as a blob, then opens an object URL — required because plain
 * links can't carry Authorization headers.
 */
export async function openMediaUrl(path: string | null | undefined): Promise<void> {
  const url = resolveMediaUrl(path);
  if (!url) return;
  // Open the tab synchronously inside the click gesture — window.open after an
  // await is popup-blocked by Chrome/Safari.
  const win = window.open("", "_blank");
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) await parseError(res);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (win) win.location = objectUrl;
    else window.open(objectUrl, "_blank", "noopener");
  } catch (e) {
    win?.close();
    throw e;
  }
}
