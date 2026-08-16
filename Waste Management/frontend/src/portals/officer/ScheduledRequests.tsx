import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MapPin,
  Check,
  X,
  UserCheck,
  Truck,
  AlertCircle,
  Loader2,
  Building2,
  Home,
  CheckCircle2,
  Layers,
  Search,
  Filter,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, Modal, toast } from '../../components/ui';
import { useT } from '../../lib/i18n';

export interface ScheduledRequest {
  id: string;
  code: string;
  citizen: { id: string; name: string; phone?: string; email?: string };
  ward?: { id: string; name: string; code: string } | null;
  locationType: 'MY_HOME' | 'COMMON_PLOT_SOCIETY';
  address: string;
  latitude: number;
  longitude: number;
  eventReason: string;
  expectedCategories: string[];
  expectedQuantity: 'SMALL' | 'MEDIUM' | 'LARGE';
  scheduledDate: string;
  scheduledTimeSlot: 'MORNING' | 'AFTERNOON' | 'EVENING';
  additionalNotes?: string | null;
  status: 'PENDING_REVIEW' | 'APPROVED_SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string | null;
  assignedDriver?: { id: string; name: string; phone?: string } | null;
  assignedVehicle?: { id: string; registrationNumber: string; model: string } | null;
  completionPhotoUrl?: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; tone: 'brand' | 'ok' | 'warn' | 'danger' | 'muted' }> = {
  PENDING_REVIEW: { label: 'Pending Review', tone: 'warn' },
  APPROVED_SCHEDULED: { label: 'Approved (Needs Driver)', tone: 'ok' },
  ASSIGNED: { label: 'Driver Assigned', tone: 'brand' },
  IN_PROGRESS: { label: 'In Progress', tone: 'brand' },
  COMPLETED: { label: 'Completed', tone: 'ok' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CANCELLED: { label: 'Cancelled by Citizen', tone: 'muted' },
};

const TIME_SLOT_LABELS = {
  MORNING: 'Morning (07:00 AM – 11:00 AM)',
  AFTERNOON: 'Afternoon (11:00 AM – 03:00 PM)',
  EVENING: 'Evening (03:00 PM – 07:00 PM)',
};

export default function ScheduledRequests() {
  const t = useT();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [rejectingItem, setRejectingItem] = useState<ScheduledRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [assigningItem, setAssigningItem] = useState<ScheduledRequest | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Fetch Ward Scheduled Requests
  const { data, isLoading } = useQuery<{ items: ScheduledRequest[] }>({
    queryKey: ['officer', 'scheduled-requests'],
    queryFn: async () => {
      const res = await api('officer').get('/officer/scheduled-requests');
      return res.data;
    },
    refetchInterval: 10000,
  });

  // Fetch Drivers for Assignment
  const { data: driversData } = useQuery<{ items: any[] }>({
    queryKey: ['officer', 'drivers-list'],
    queryFn: async () => {
      const res = await api('officer').get('/officer/fleet');
      return { items: res.data?.drivers || res.data?.vehicles || [] };
    },
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api('officer').post(`/officer/scheduled-requests/${id}/approve`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Request #${data.item?.code || ''} approved.`);
      queryClient.invalidateQueries({ queryKey: ['officer', 'scheduled-requests'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api('officer').post(`/officer/scheduled-requests/${id}/reject`, { reason });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Request rejected and citizen notified.');
      queryClient.invalidateQueries({ queryKey: ['officer', 'scheduled-requests'] });
      setRejectingItem(null);
      setRejectReason('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Assign Driver Mutation
  const assignMutation = useMutation({
    mutationFn: async ({ id, driverId }: { id: string; driverId: string }) => {
      const res = await api('officer').post(`/officer/scheduled-requests/${id}/assign`, { driverId });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Driver assigned successfully.');
      queryClient.invalidateQueries({ queryKey: ['officer', 'scheduled-requests'] });
      setAssigningItem(null);
      setSelectedDriverId('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const allItems = data?.items ?? [];
  const filtered = allItems.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.code.toLowerCase().includes(q) ||
        item.eventReason.toLowerCase().includes(q) ||
        item.citizen.name.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-fluid-xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Calendar className="h-6 w-6 text-brand" /> Advance Scheduled Requests
          </h1>
          <p className="text-fluid-xs text-muted">
            Manage advance event waste bookings (weddings, society events, renovations). Sorted by scheduled date for advance planning.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2">
          <Badge tone="warn" className="font-bold">
            {allItems.filter((i) => i.status === 'PENDING_REVIEW').length} Pending
          </Badge>
          <Badge tone="ok" className="font-bold">
            {allItems.filter((i) => i.status === 'APPROVED_SCHEDULED').length} Ready to Assign
          </Badge>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 border border-line bg-surface shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search code, event, citizen…"
              className="field w-full pl-9 text-fluid-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {['ALL', 'PENDING_REVIEW', 'APPROVED_SCHEDULED', 'ASSIGNED', 'COMPLETED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-fluid-xs font-semibold transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-brand text-brand-ink shadow-xs'
                    : 'bg-sunken text-muted hover:text-ink'
                }`}
              >
                {st === 'ALL' ? 'All Requests' : STATUS_CONFIG[st]?.label || st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Requests List */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-fluid-xs font-medium">Loading scheduled requests…</p>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-12 text-center border border-line bg-surface shadow-xs space-y-2">
          <p className="text-fluid-base font-bold text-ink">No Scheduled Requests Found</p>
          <p className="text-fluid-xs text-muted">
            {statusFilter !== 'ALL'
              ? `No requests currently matching status filter "${statusFilter}".`
              : 'Citizens have not submitted any advance event pickups in your ward yet.'}
          </p>
        </Card>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((item) => {
            const statusMeta = STATUS_CONFIG[item.status] || { label: item.status, tone: 'muted' as const };
            const dateObj = new Date(item.scheduledDate);

            return (
              <Card key={item.id} className="p-5 border border-line bg-surface shadow-xs hover:shadow-sm transition space-y-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-fluid-xs font-bold text-ink bg-sunken px-2.5 py-1 rounded-xl border border-line">
                      {item.code}
                    </span>
                    <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                      {item.locationType === 'MY_HOME' ? <Home className="h-3.5 w-3.5 text-brand" /> : <Building2 className="h-3.5 w-3.5 text-brand" />}
                      {item.locationType === 'MY_HOME' ? 'Home' : 'Common Plot / Society'}
                    </span>
                    {item.ward && (
                      <span className="text-[10px] font-bold text-muted bg-elevated px-2 py-0.5 rounded border border-line">
                        Ward: {item.ward.name}
                      </span>
                    )}
                  </div>

                  <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Event & Citizen Info (7 cols) */}
                  <div className="md:col-span-7 space-y-2">
                    <h3 className="text-fluid-base font-bold text-ink">{item.eventReason}</h3>
                    <p className="text-fluid-xs text-muted flex items-start gap-1.5">
                      <MapPin className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span>{item.address}</span>
                    </p>

                    <div className="flex items-center gap-3 text-fluid-xs pt-1 text-muted">
                      <span>Citizen: <strong className="text-ink">{item.citizen.name}</strong></span>
                      {item.citizen.phone && <span className="font-mono">({item.citizen.phone})</span>}
                    </div>

                    {/* Waste Categories & Load */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-ink">Load: {item.expectedQuantity}</span>
                      {(item.expectedCategories || []).map((cat) => (
                        <span key={cat} className="rounded-lg bg-sunken border border-line px-2 py-0.5 text-[10px] font-medium text-muted">
                          {cat}
                        </span>
                      ))}
                    </div>

                    {item.additionalNotes && (
                      <p className="text-[11px] text-muted italic bg-sunken/60 p-2 rounded-xl border border-line/50 mt-1">
                        Note: "{item.additionalNotes}"
                      </p>
                    )}
                  </div>

                  {/* Date Slot & Assignment Box (5 cols) */}
                  <div className="md:col-span-5 rounded-2xl border border-line bg-sunken p-4 text-fluid-xs space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-ink font-bold text-fluid-sm">
                        <Calendar className="h-4 w-4 text-brand" />
                        <span>{dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <p className="text-[11px] text-muted flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted" />
                        <span>{TIME_SLOT_LABELS[item.scheduledTimeSlot]}</span>
                      </p>
                    </div>

                    {/* Driver Status */}
                    {item.assignedDriver ? (
                      <div className="rounded-xl border border-brand/20 bg-brand/5 p-2.5 text-brand space-y-0.5">
                        <p className="font-bold flex items-center gap-1.5 text-[11px]">
                          <Truck className="h-3.5 w-3.5" /> Assigned: {item.assignedDriver.name}
                        </p>
                        {item.assignedVehicle && (
                          <p className="text-[10px] font-mono text-muted">Truck: {item.assignedVehicle.registrationNumber}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-warn font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Driver Not Assigned
                      </p>
                    )}
                  </div>
                </div>

                {/* Rejection / Completion Status */}
                {item.status === 'REJECTED' && item.rejectionReason && (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-fluid-xs text-danger">
                    <strong>Rejection Reason:</strong> {item.rejectionReason}
                  </div>
                )}

                {item.status === 'COMPLETED' && (
                  <div className="rounded-xl border border-ok/30 bg-ok/10 p-2.5 text-fluid-xs text-ok flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Completed & Verified (+25 Green Credits)
                    </span>
                    {item.completionPhotoUrl && (
                      <a href={item.completionPhotoUrl} target="_blank" rel="noreferrer" className="underline font-bold text-[11px]">
                        View Proof
                      </a>
                    )}
                  </div>
                )}

                {/* Officer Action Bar */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-line/40">
                  {item.status === 'PENDING_REVIEW' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejectingItem(item)}
                        className="inline-flex items-center gap-1 rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-fluid-xs font-bold text-danger hover:bg-danger/20 transition cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>

                      <button
                        type="button"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(item.id)}
                        className="btn-primary rounded-xl px-4 py-1.5 text-fluid-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve Request
                      </button>
                    </>
                  )}

                  {['PENDING_REVIEW', 'APPROVED_SCHEDULED'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => setAssigningItem(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand/10 px-4 py-1.5 text-fluid-xs font-bold text-brand hover:bg-brand/20 transition cursor-pointer shadow-xs"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Assign Driver
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <Modal
          open={!!rejectingItem}
          onClose={() => setRejectingItem(null)}
          title={`Reject Scheduled Request #${rejectingItem.code}`}
        >
          <div className="space-y-4 pt-2">
            <p className="text-fluid-xs text-muted">
              Provide a clear reason why this advance pickup cannot be accommodated. The citizen will be notified immediately.
            </p>
            <textarea
              rows={3}
              className="field w-full text-fluid-xs"
              placeholder="e.g. Hazardous chemical waste cannot be collected by municipal compactor trucks. Please contact state pollution board."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="btn-secondary text-fluid-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectingItem.id, reason: rejectReason })}
                className="btn-danger text-fluid-xs"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Driver Modal */}
      {assigningItem && (
        <Modal
          open={!!assigningItem}
          onClose={() => setAssigningItem(null)}
          title={`Assign Driver for #${assigningItem.code}`}
        >
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-sunken border border-line text-fluid-xs space-y-1">
              <p className="font-bold text-ink">{assigningItem.eventReason}</p>
              <p className="text-muted">Scheduled for: <strong>{new Date(assigningItem.scheduledDate).toLocaleDateString('en-IN')} ({assigningItem.scheduledTimeSlot})</strong></p>
              <p className="text-muted truncate">Address: {assigningItem.address}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-fluid-xs font-bold text-ink">Select Ward Collection Driver</label>
              <select
                className="field w-full text-fluid-xs"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                <option value="">-- Choose Driver --</option>
                {(driversData?.items || []).map((d: any) => (
                  <option key={d.id || d.driverId} value={d.driver?.id || d.id || d.driverId}>
                    {d.driver?.name || d.name || 'Driver'} ({d.registrationNumber || d.model || 'Vehicle'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssigningItem(null)}
                className="btn-secondary text-fluid-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedDriverId || assignMutation.isPending}
                onClick={() => assignMutation.mutate({ id: assigningItem.id, driverId: selectedDriverId })}
                className="btn-primary text-fluid-xs"
              >
                {assignMutation.isPending ? 'Assigning…' : 'Assign & Dispatch'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
