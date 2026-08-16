import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, RequireRole } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { tokenStore } from './lib/api';
import { Loading, Toaster } from './components/ui';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

const Splash = lazy(() => import('./pages/Splash'));
const CitizenPortal = lazy(() => import('./portals/citizen/CitizenPortal'));
const DriverPortal = lazy(() => import('./portals/driver/DriverPortal'));
const OfficerPortal = lazy(() => import('./portals/officer/OfficerPortal'));
const AdminPortal = lazy(() => import('./portals/admin/AdminPortal'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// The Entry component was removed as Splash is now global in App.

/** Google redirects back here with the access token in the query string. */
function GoogleReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    tokenStore.set('citizen', token);
    // Strip the token from history so it does not linger in the URL bar.
    navigate('/app', { replace: true });
  }, [params, navigate]);

  return <Loading label="Finishing sign-in…" />;
}

const suspense = (node: React.ReactNode) => (
  <Suspense fallback={<Loading label="Loading…" />}>{node}</Suspense>
);

export default function App() {
  const [introDone, setIntroDone] = useState(false);

  if (!introDone) {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-surface" />}>
        <Splash onDone={() => setIntroDone(true)} />
      </Suspense>
    );
  }

  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster />
        <Routes>
          {/* ---- Public ---- */}
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

          {/* ---- Driver portal (own login domain) ---- */}
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </I18nProvider>
  );
}
