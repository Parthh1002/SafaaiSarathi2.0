import { Route, Routes } from 'react-router-dom';
import { Home, PlusCircle, ListChecks, Trophy, Phone, Calendar } from 'lucide-react';
import { MobileShell, type NavItem } from '../../components/shells';
import { useT } from '../../lib/i18n';
import CitizenHome from './Home';
import NewReport from './NewReport';
import MyComplaints from './MyComplaints';
import ComplaintDetail from './ComplaintDetail';
import TrackTruck from './TrackTruck';
import Rewards from './Rewards';
import Directory from './Directory';
import EmergencyReport from './EmergencyReport';
import Profile from './Profile';
import SchedulePickup from './SchedulePickup';
import MyScheduledRequests from './MyScheduledRequests';

export default function CitizenPortal() {
  const t = useT();
  const nav: NavItem[] = [
    { to: '/app', label: t('citizen.nav.home'), icon: Home, end: true },
    { to: '/app/report', label: t('citizen.nav.report'), icon: PlusCircle },
    { to: '/app/schedule-pickup', label: 'Schedule Event', icon: Calendar },
    { to: '/app/complaints', label: t('citizen.nav.complaints'), icon: ListChecks },
    { to: '/app/rewards', label: t('citizen.nav.rewards'), icon: Trophy },
  ];

  return (
    <MobileShell nav={nav} title="Citizen Hub">
      <Routes>
        <Route index element={<CitizenHome />} />
        <Route path="report" element={<NewReport />} />
        <Route path="emergency" element={<EmergencyReport />} />
        <Route path="schedule-pickup" element={<SchedulePickup />} />
        <Route path="scheduled-requests" element={<MyScheduledRequests />} />
        <Route path="complaints" element={<MyComplaints />} />
        <Route path="complaints/:id" element={<ComplaintDetail />} />
        <Route path="track/:id" element={<TrackTruck />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="directory" element={<Directory />} />
        <Route path="profile" element={<Profile />} />
      </Routes>
    </MobileShell>
  );
}
