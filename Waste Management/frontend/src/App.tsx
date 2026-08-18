import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, RequireRole } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { tokenStore } from './lib/api';
import { Toaster } from './components/ui';
import { Chatbot } from './components/Chatbot';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

/** Resilient lazy import that retries automatically on chunk load failure */
function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      console.warn('[App] Dynamic chunk import failed, retrying once...', error);
      await new Promise((resolve) => setTimeout(resolve, 350));
      try {
        return await factory();
      } catch (retryError) {
        console.error('[App] Retry failed, reloading window...', retryError);
        window.location.reload();
        throw retryError;
      }
    }
  });
}

const Splash = lazyRetry(() => import('./pages/Splash'));
const CitizenPortal = lazyRetry(() => import('./portals/citizen/CitizenPortal'));
const DriverPortal = lazyRetry(() => import('./portals/driver/DriverPortal'));
const OfficerPortal = lazyRetry(() => import('./portals/officer/OfficerPortal'));
const AdminPortal = lazyRetry(() => import('./portals/admin/AdminPortal'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PortalLoader() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-line border-t-brand" />
        <p className="text-fluid-xs font-semibold text-muted">Loading Portal Console…</p>
      </div>
    </div>
  );
}

/** Google redirects back here with the access token and user role in the query string. */
function GoogleReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const role = (params.get('role') || 'CITIZEN').toUpperCase();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      tokenStore.set('admin', token);
      navigate('/admin', { replace: true });
    } else if (role === 'OFFICER') {
      tokenStore.set('officer', token);
      navigate('/officer', { replace: true });
    } else if (role === 'DRIVER') {
      tokenStore.set('driver', token);
      navigate('/driver', { replace: true });
    } else {
      tokenStore.set('citizen', token);
      navigate('/app', { replace: true });
    }
  }, [params, navigate]);

  return <PortalLoader />;
}

const suspense = (node: React.ReactNode) => (
  <Suspense fallback={<PortalLoader />}>{node}</Suspense>
);

export default function App() {
  // STRICT: Every hard refresh / full page load forces Intro Splash first, then hands off to destination
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashDone = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-dvh bg-black flex items-center justify-center text-emerald-500 font-mono text-xs">Loading Safaai Sarathi…</div>}>
          <Splash onDone={handleSplashDone} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Toaster />
            <Chatbot />
            <Routes>
              {/* ---- Public Landing ---- */}
              <Route path="/" element={<Landing />} />

              {/* ---- Citizen portal ---- */}
              <Route
                path="/login"
                element={
                  <AuthProvider portal="citizen">
                    <Login portal="citizen" />
                  </AuthProvider>
                }
              />
              <Route
                path="/register"
                element={
                  <AuthProvider portal="citizen">
                    <Register />
                  </AuthProvider>
                }
              />
              <Route
                path="/auth/google/return"
                element={
                  <AuthProvider portal="citizen">
                    <GoogleReturn />
                  </AuthProvider>
                }
              />
              <Route
                path="/app/*"
                element={
                  <AuthProvider portal="citizen">
                    <RequireRole role="CITIZEN">{suspense(<CitizenPortal />)}</RequireRole>
                  </AuthProvider>
                }
              />

              {/* ---- Driver portal ---- */}
              <Route
                path="/driver/login"
                element={
                  <AuthProvider portal="driver">
                    <Login portal="driver" />
                  </AuthProvider>
                }
              />
              <Route
                path="/driver/*"
                element={
                  <AuthProvider portal="driver">
                    <RequireRole role="DRIVER">{suspense(<DriverPortal />)}</RequireRole>
                  </AuthProvider>
                }
              />

              {/* ---- Officer console ---- */}
              <Route
                path="/officer/login"
                element={
                  <AuthProvider portal="officer">
                    <Login portal="officer" />
                  </AuthProvider>
                }
              />
              <Route
                path="/officer/*"
                element={
                  <AuthProvider portal="officer">
                    <RequireRole role="OFFICER">{suspense(<OfficerPortal />)}</RequireRole>
                  </AuthProvider>
                }
              />

              {/* ---- Super Admin console ---- */}
              <Route
                path="/admin/login"
                element={
                  <AuthProvider portal="admin">
                    <Login portal="admin" />
                  </AuthProvider>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <AuthProvider portal="admin">
                    <RequireRole role="ADMIN">{suspense(<AdminPortal />)}</RequireRole>
                  </AuthProvider>
                }
              />

              {/* Catch-all route gracefully navigates to Landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
