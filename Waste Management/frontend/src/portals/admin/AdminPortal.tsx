import { Route, Routes } from 'react-router-dom';
import { Activity, BarChart3, FileDown, LayoutDashboard, ScrollText, Truck, Users, MapPinned } from 'lucide-react';
import { ConsoleShell, type NavItem } from '../../components/shells';
import { useT } from '../../lib/i18n';
import AdminDashboard from './Dashboard';
import MasterFleet from './MasterFleet';
import UserManagement from './UserManagement';
import CityAnalytics from './CityAnalytics';
import ComplianceExport from './ComplianceExport';
import AuditLog from './AuditLog';
import ModelHealth from './ModelHealth';
import WardSettings from './WardSettings';

export default function AdminPortal() {
  const t = useT();
  const nav: NavItem[] = [
    { to: '/admin', label: t('admin.nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admin/fleet', label: t('admin.nav.fleet'), icon: Truck },
    { to: '/admin/users', label: t('admin.nav.users'), icon: Users },
    { to: '/admin/analytics', label: t('admin.nav.analytics'), icon: BarChart3 },
    { to: '/admin/compliance', label: t('admin.nav.compliance'), icon: FileDown },
    { to: '/admin/audit', label: t('admin.nav.audit'), icon: ScrollText },
    { to: '/admin/model', label: t('admin.nav.model'), icon: Activity },
    { to: '/admin/wards', label: t('admin.nav.wards'), icon: MapPinned },
  ];

  return (
    <ConsoleShell
      nav={nav}
      title={t('admin.title')}
      subtitle={t('admin.subtitle')}
      accent="orange"
    >
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="fleet" element={<MasterFleet />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="analytics" element={<CityAnalytics />} />
        <Route path="compliance" element={<ComplianceExport />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="model" element={<ModelHealth />} />
        <Route path="wards" element={<WardSettings />} />
      </Routes>
    </ConsoleShell>
  );
}
