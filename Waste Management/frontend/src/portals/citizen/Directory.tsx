import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { Phone, WifiOff, Flame, Ambulance, Shield, Bug, Dog, Headphones } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, ErrorState, Loading, SectionTitle } from '../../components/ui';

/**
 * Community directory. Cached in localStorage on first load so it still works
 * offline — which is exactly when someone needs a fire or ambulance number.
 */

const CACHE_KEY = 'ss_directory_cache';

const ICONS: Record<string, typeof Phone> = {
  helpline: Headphones,
  fire: Flame,
  hospital: Ambulance,
  police: Shield,
  animal_control: Dog,
  pest_control: Bug,
};

export default function Directory() {
  const t = useT();
  const [cached, setCached] = useState<any[] | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) setCached(JSON.parse(raw));
    } catch {
      /* ignore a corrupt cache */
    }
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['citizen', 'directory'],
    queryFn: async () => {
      const res = await api('citizen').get('/citizen/directory');
      localStorage.setItem(CACHE_KEY, JSON.stringify(res.data));
      return res.data;
    },
  });

  const contacts = data ?? cached;

  if (isLoading && !contacts) return <Loading />;
  if (error && !contacts) return <ErrorState message="Could not load the directory" onRetry={() => refetch()} />;

  const grouped = (contacts ?? []).reduce((acc: Record<string, any[]>, c: any) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-fluid-xl font-bold tracking-tight">Helpline directory</h1>
        <p className="mt-1 text-fluid-sm text-muted">Saved on your device so it works without a connection.</p>
      </div>

      {(offline || (error && cached)) && (
        <p className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-fluid-xs text-warn">
          <WifiOff className="h-4 w-4 shrink-0" />
          You're offline — showing the numbers saved last time.
        </p>
      )}

      {Object.entries(grouped).map(([category, items]) => {
        const Icon = ICONS[category] ?? Phone;
        return (
          <section key={category}>
            <SectionTitle title={t(`directory.${category}`)} />
            <Card className="divide-y divide-line p-0">
              {(items as any[]).map((c) => (
                <a
                  key={c.id}
                  href={`tel:${c.phone.replace(/\s/g, '')}`}
                  className="flex min-h-touch items-center gap-3 px-4 py-3 transition active:bg-sunken"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fluid-sm font-semibold">{c.name}</span>
                    <span className="block font-mono text-fluid-xs text-muted">{c.phone}</span>
                  </span>
                  <Phone className="h-4 w-4 shrink-0 text-brand" />
                </a>
              ))}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
