import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, tokenStore, type Portal } from './api';

/**
 * Auth context, instantiated once per portal.
 *
 * `RequireRole` mirrors the server guard: even a stale session cannot render
 * the wrong shell, and each portal redirects to its own login route rather
 * than a shared one.
 */

export interface SessionUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: 'CITIZEN' | 'DRIVER' | 'OFFICER' | 'ADMIN';
  portal: Portal;
  wardId?: string | null;
  ward?: { id: string; name: string; code: string } | null;
  language?: string;
  greenCredits?: number;
  avatarColor?: string;
  twoFactorEnabled?: boolean;
}

interface AuthValue {
  portal: Portal;
  user: SessionUser | null;
  loading: boolean;
  signIn: (token: string, user: SessionUser) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const LOGIN_ROUTE: Record<Portal, string> = {
  citizen: '/login',
  driver: '/driver/login',
  officer: '/officer/login',
  admin: '/admin/login',
};

export const HOME_ROUTE: Record<Portal, string> = {
  citizen: '/app',
  driver: '/driver',
  officer: '/officer',
  admin: '/admin',
};

export function AuthProvider({ portal, children }: { portal: Portal; children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => tokenStore.getUser<SessionUser>(portal));
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get(portal)) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api(portal).get(`/auth/${portal}/me`);
      setUser(data.user);
      tokenStore.setUser(portal, data.user);

      // Adopt the language saved on the account, unless this device has already
      // been set to something else deliberately.
      if (data.user?.language && !localStorage.getItem('ss_locale')) {
        localStorage.setItem('ss_locale', data.user.language);
        window.dispatchEvent(new CustomEvent('ss:locale-changed', { detail: { locale: data.user.language } }));
      }
    } catch {
      setUser(null);
      tokenStore.clear(portal);
    } finally {
      setLoading(false);
    }
  }, [portal]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  // The api client fires this when a refresh finally fails.
  useEffect(() => {
    const onExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ portal: Portal }>).detail;
      if (detail?.portal !== portal) return;
      setUser(null);
      tokenStore.clear(portal);
    };
    window.addEventListener('ss:session-expired', onExpired);
    return () => window.removeEventListener('ss:session-expired', onExpired);
  }, [portal]);

  const signIn = useCallback(
    (token: string, nextUser: SessionUser) => {
      tokenStore.set(portal, token);
      tokenStore.setUser(portal, nextUser);
      setUser(nextUser);
      setLoading(false);
    },
    [portal]
  );

  const signOut = useCallback(async () => {
    try {
      await api(portal).post('/auth/logout');
    } catch {
      /* the local session is cleared regardless */
    }
    tokenStore.clear(portal);
    setUser(null);
  }, [portal]);

  const value = useMemo<AuthValue>(
    () => ({ portal, user, loading, signIn, signOut, refresh: loadMe }),
    [portal, user, loading, signIn, signOut, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

/** Route guard — the client-side half of the portal isolation. */
export function RequireRole({ role, children }: { role: SessionUser['role']; children: ReactNode }) {
  const { user, loading, portal } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
          <p className="text-fluid-sm text-muted">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={LOGIN_ROUTE[portal]} state={{ from: location.pathname }} replace />;
  }

  // Admins may enter the officer console; nothing else crosses.
  const allowed = user.role === role || (role === 'OFFICER' && user.role === 'ADMIN');
  if (!allowed) {
    return <Navigate to={HOME_ROUTE[user.portal] ?? '/'} replace />;
  }

  return <>{children}</>;
}
