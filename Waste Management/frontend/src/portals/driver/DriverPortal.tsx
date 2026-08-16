import { useEffect, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Map, ListChecks, BarChart3, Siren, Fuel } from 'lucide-react';
import { MobileShell, type NavItem } from '../../components/shells';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Badge } from '../../components/ui';
import { useT } from '../../lib/i18n';
import DriverRoute from './DriverRoute';
import DriverStops from './DriverStops';
import DriverFuel from './DriverFuel';
import DriverSummary from './DriverSummary';
import DriverSos from './DriverSos';

function useLocationBroadcast(enabled: boolean) {
  const queue = useRef<any[]>([]);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    const socket = getSocket('driver');
    let lastSent = 0;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent < 3000) return;
        lastSent = now;

        const payload = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed != null ? pos.coords.speed * 3.6 : undefined,
          ts: now,
        };

        if (navigator.onLine && socket.connected) {
          socket.emit('driver:location', payload);
        } else {
          queue.current.push(payload);
          if (queue.current.length > 500) queue.current.shift();
        }
      },
      () => {
        /* permission denied */
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10_000 }
    );

    const flush = async () => {
      setOnline(true);
      if (!queue.current.length) return;
      const points = queue.current.splice(0, queue.current.length);
      try {
        await api('driver').post('/driver/location/batch', { points });
      } catch {
        queue.current.unshift(...points);
      }
    };

    const goOffline = () => setOnline(false);
    window.addEventListener('online', flush);
    window.addEventListener('offline', goOffline);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('online', flush);
      window.removeEventListener('offline', goOffline);
    };
  }, [enabled]);

  return { online, queued: queue.current.length };
}

export default function DriverPortal() {
  const t = useT();
  const nav: NavItem[] = [
    { to: '/driver', label: t('driver.nav.route'), icon: Map, end: true },
    { to: '/driver/stops', label: t('driver.nav.stops'), icon: ListChecks },
    { to: '/driver/fuel', label: 'Fuel Log', icon: Fuel },
    { to: '/driver/summary', label: t('driver.nav.shift'), icon: BarChart3 },
    { to: '/driver/sos', label: t('driver.nav.sos'), icon: Siren },
  ];
  const [broadcasting, setBroadcasting] = useState(true);
  const { online } = useLocationBroadcast(broadcasting);

  return (
    <MobileShell
      nav={nav}
      title={t('driver.title')}
      accent="brand"
      headerRight={
        <button
          type="button"
          onClick={() => setBroadcasting((v) => !v)}
          title={broadcasting ? 'GPS sharing on' : 'GPS sharing paused'}
        >
          <Badge tone={!online ? 'warn' : broadcasting ? 'ok' : 'neutral'}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                !online ? 'bg-warn' : broadcasting ? 'animate-pulse bg-ok' : 'bg-faint'
              }`}
            />
            {!online ? t('driver.offline') : broadcasting ? t('driver.gpsLive') : t('driver.gpsOff')}
          </Badge>
        </button>
      }
    >
      <Routes>
        <Route index element={<DriverRoute />} />
        <Route path="stops" element={<DriverStops />} />
        <Route path="fuel" element={<DriverFuel />} />
        <Route path="summary" element={<DriverSummary />} />
        <Route path="sos" element={<DriverSos />} />
      </Routes>
    </MobileShell>
  );
}
