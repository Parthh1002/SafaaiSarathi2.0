import axios, { AxiosError, type AxiosInstance } from 'axios';

/**
 * One axios instance per portal (plan §3).
 *
 * Each portal keeps its own access token under its own storage key, so a
 * citizen session and an officer session can coexist in one browser without
 * ever bleeding into each other — and a token is only ever sent to its own
 * API namespace. The refresh cookie is httpOnly and scoped to /api/auth, so
 * JavaScript never touches it.
 */

export type Portal = 'citizen' | 'driver' | 'officer' | 'admin';

export const BASE = import.meta.env.VITE_API_URL || '';
const tokenKey = (portal: Portal) => `ss_token_${portal}`;
const userKey = (portal: Portal) => `ss_user_${portal}`;

export const tokenStore = {
  get(portal: Portal) {
    try {
      return localStorage.getItem(tokenKey(portal));
    } catch {
      return null;
    }
  },
  set(portal: Portal, token: string) {
    localStorage.setItem(tokenKey(portal), token);
  },
  clear(portal: Portal) {
    localStorage.removeItem(tokenKey(portal));
    localStorage.removeItem(userKey(portal));
  },
  getUser<T>(portal: Portal): T | null {
    try {
      const raw = localStorage.getItem(userKey(portal));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  setUser(portal: Portal, user: unknown) {
    localStorage.setItem(userKey(portal), JSON.stringify(user));
  },
};

const clients = new Map<Portal, AxiosInstance>();

export function api(portal: Portal): AxiosInstance {
  const existing = clients.get(portal);
  if (existing) return existing;

  const client = axios.create({
    baseURL: `${BASE}/api`,
    withCredentials: true, // carries the httpOnly refresh cookie
    timeout: 120_000,
  });

  client.interceptors.request.use((config) => {
    const token = tokenStore.get(portal);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // A single in-flight refresh, shared by every request that hits a 401.
  let refreshing: Promise<string | null> | null = null;

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<{ error?: string; expired?: boolean; code?: string }>) => {
      const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
      const status = error.response?.status;

      // A portal mismatch is a hard stop, never something to retry.
      if (status === 403 && error.response?.data?.code === 'PORTAL_MISMATCH') {
        tokenStore.clear(portal);
        return Promise.reject(error);
      }

      if (status === 401 && original && !original._retried && !original.url?.includes('/auth/')) {
        original._retried = true;
        refreshing =
          refreshing ??
          axios
            .post(`${BASE}/api/auth/refresh`, { portal }, { withCredentials: true })
            .then((r) => {
              const token = r.data.accessToken as string;
              tokenStore.set(portal, token);
              if (r.data.user) tokenStore.setUser(portal, r.data.user);
              return token;
            })
            .catch(() => {
              tokenStore.clear(portal);
              return null;
            })
            .finally(() => {
              refreshing = null;
            });

        const token = await refreshing;
        if (token) {
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization = `Bearer ${token}`;
          return client.request(original);
        }
        // Refresh failed — send them to this portal's own login screen.
        window.dispatchEvent(new CustomEvent('ss:session-expired', { detail: { portal } }));
      }

      return Promise.reject(error);
    }
  );

  clients.set(portal, client);
  return client;
}

/** Turn any axios failure into a sentence worth showing a user. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const axiosErr = err as AxiosError<{ error?: string; fields?: Record<string, string[]> }>;
  const data = axiosErr?.response?.data;
  if (data?.fields) {
    const first = Object.values(data.fields)[0];
    if (first?.[0]) return first[0];
  }
  if (data?.error) return data.error;
  if (axiosErr?.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the API running on port 5100?';
  if (axiosErr?.message) return axiosErr.message;
  return fallback;
}

/** Public endpoints need no portal token. */
export const publicApi = axios.create({ baseURL: `${BASE}/api/public`, timeout: 120_000 });

export const assetUrl = (path?: string | null) => (path ? `${BASE}${path}` : null);
