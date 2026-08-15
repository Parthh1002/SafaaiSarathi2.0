import { useQuery } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { LayoutDashboard, ListFilter, Siren, TrendingUp, Truck, ArrowUpRight, BarChart3 } from 'lucide-react';
import { ConsoleShell, type NavItem } from '../../components/shells';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import OfficerDashboard from './Dashboard';
import ComplaintQueue from './ComplaintQueue';
import Emergencies from './Emergencies';
import Hotspots from './Hotspots';
import Fleet from './Fleet';
import Escalations from './Escalations';
import Analytics from './Analytics';

export default function OfficerPortal() {
  const { user } = useAuth();
  const t = useT();

  // Badge counts come from the same overview the dashboard renders.
  const { data } = useQuery({
    queryKey: ['officer', 'overview'],
    queryFn: async () => (await api('officer').get('/officer/overview')).data,
    refetchInterval: 30_000,
  });

  const nav: NavItem[] = [
    { to: '/officer', label: t('officer.nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/officer/queue', label: t('officer.nav.queue'), icon: ListFilter, badge: data?.kpis?.reviewNeeded },
    { to: '/officer/emergencies', label: t('officer.nav.emergencies'), icon: Siren, badge: data?.kpis?.emergenciesOpen },
    { to: '/officer/hotspots', label: t('officer.nav.hotspots'), icon: TrendingUp },
    { to: '/officer/fleet', label: t('officer.nav.fleet'), icon: Truck },
    { to: '/officer/escalations', label: t('officer.nav.escalations'), icon: ArrowUpRight },
    { to: '/officer/analytics', label: t('officer.nav.analytics'), icon: BarChart3 },
  ];

  return (
    <ConsoleShell
      nav={nav}
      title={t('officer.title')}
      subtitle={user?.ward?.name ? `${user.ward.name} · ${user.ward.code}` : t('officer.subtitle')}
      alertCount={data?.kpis?.emergenciesOpen ?? 0}
    >
      <Routes>
        <Route index element={<OfficerDashboard />} />
        <Route path="queue" element={<ComplaintQueue />} />
        <Route path="emergencies" element={<Emergencies />} />
        <Route path="hotspots" element={<Hotspots />} />
        <Route path="fleet" element={<Fleet />} />
        <Route path="escalations" element={<Escalations />} />
        <Route path="analytics" element={<Analytics />} />
      </Routes>
    </ConsoleShell>
  );
}
