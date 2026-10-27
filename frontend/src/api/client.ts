import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

const ACCESS_KEY = "worktrack.access";
const REFRESH_KEY = "worktrack.refresh";

export const tokenStorage = {
  get access() { return localStorage.getItem(ACCESS_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = tokenStorage.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// One shared refresh call, even if several requests fail with 401 at once.
let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.refresh;
  if (!refresh) throw new Error("No refresh token");
  const { data } = await axios.post<{ access: string; refresh?: string }>(
    `${API_URL}/auth/refresh/`,
    { refresh },
  );
  tokenStorage.set(data.access, data.refresh ?? refresh);
  return data.access;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url ?? "";
    const isAuthCall = url.includes("/auth/login/") || url.includes("/auth/refresh/");

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
        const token = await refreshing;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        tokenStorage.clear();
        window.dispatchEvent(new Event("auth:expired"));
      }
    }
    return Promise.reject(error);
  },
);

// ---------- error helpers (backend envelope: {error: {code, message, details}}) ----------
interface ApiErrorBody { error?: { code: string; message: string; details?: unknown } }
export type FieldErrors = Record<string, string>;
export interface FormErrors { message: string; fields: FieldErrors }

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    if (!err.response) return "Cannot reach the server. Check your connection and try again.";
    return err.response.data?.error?.message ?? `Request failed (${err.response.status}).`;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function getFieldErrors(err: unknown): FieldErrors {
  const out: FieldErrors = {};
  if (!axios.isAxiosError<ApiErrorBody>(err)) return out;
  const details = err.response?.data?.error?.details;
  if (Array.isArray(details)) {
    out.non_field_errors = details.join(" ");
  } else if (details && typeof details === "object") {
    for (const [key, value] of Object.entries(details)) {
      out[key] = Array.isArray(value) ? value.join(" ") : String(value);
    }
  }
  return out;
}

export function parseFormError(err: unknown): FormErrors {
  const fields = getFieldErrors(err);
  const general = fields.non_field_errors;
  delete fields.non_field_errors;
  const hasFields = Object.keys(fields).length > 0;
  return {
    fields,
    message: general ?? (hasFields ? "Please fix the highlighted fields." : getErrorMessage(err)),
  };
}

export type ListParams = Record<string, string | number | boolean | undefined>;

/** Drop empty filters so they are not sent as ?status= */
export function clean(params?: ListParams) {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));
}