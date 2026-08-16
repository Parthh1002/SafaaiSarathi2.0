import { Route, Routes } from 'react-router-dom';
import { Home, PlusCircle, ListChecks, Trophy, Phone } from 'lucide-react';
import { MobileShell, type NavItem } from '../../components/shells';
import { useT } from '../../lib/i18n';
import { Chatbot } from '../../components/Chatbot';
import CitizenHome from './Home';
import NewReport from './NewReport';
import MyComplaints from './MyComplaints';
import ComplaintDetail from './ComplaintDetail';
import TrackTruck from './TrackTruck';
import Rewards from './Rewards';
import Directory from './Directory';
import EmergencyReport from './EmergencyReport';
import Profile from './Profile';

export default function CitizenPortal() {
  const t = useT();
  const nav: NavItem[] = [
    { to: '/app', label: t('citizen.nav.home'), icon: Home, end: true },
    { to: '/app/report', label: t('citizen.nav.report'), icon: PlusCircle },
    { to: '/app/complaints', label: t('citizen.nav.complaints'), icon: ListChecks },
    { to: '/app/rewards', label: t('citizen.nav.rewards'), icon: Trophy },
    { to: '/app/directory', label: t('citizen.nav.directory'), icon: Phone },
  ];

  return (
    <MobileShell nav={nav} title={t('common.appName')}>
      <Routes>
        <Route index element={<CitizenHome />} />
        <Route path="report" element={<NewReport />} />
        <Route path="emergency" element={<EmergencyReport />} />
        <Route path="complaints" element={<MyComplaints />} />
        <Route path="complaints/:id" element={<ComplaintDetail />} />
        <Route path="track/:id" element={<TrackTruck />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="directory" element={<Directory />} />
        <Route path="profile" element={<Profile />} />
      </Routes>
      <Chatbot />
    </MobileShell>
  );
}
