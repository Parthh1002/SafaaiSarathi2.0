import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Loader2,
  Building2,
  Home,
  Truck,
  User,
  Layers,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, toast } from '../../components/ui';
import { useT } from '../../lib/i18n';

export interface ScheduledPickupItem {
  id: string;
  code: string;
  locationType: 'MY_HOME' | 'COMMON_PLOT_SOCIETY';
  address: string;
  eventReason: string;
  expectedCategories: string[];
  expectedQuantity: 'SMALL' | 'MEDIUM' | 'LARGE';
  scheduledDate: string;
  scheduledTimeSlot: 'MORNING' | 'AFTERNOON' | 'EVENING';
  additionalNotes?: string | null;
  status: 'PENDING_REVIEW' | 'APPROVED_SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string | null;
  assignedDriver?: { id: string; name: string; phone: string } | null;
  assignedVehicle?: { id: string; registrationNumber: string; model: string } | null;
  ward?: { id: string; name: string } | null;
  completionPhotoUrl?: string | null;
  reminderSent: boolean;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; tone: 'brand' | 'ok' | 'warn' | 'danger' | 'muted' }> = {
  PENDING_REVIEW: { label: 'Pending Review', tone: 'warn' },
  APPROVED_SCHEDULED: { label: 'Approved & Scheduled', tone: 'ok' },
  ASSIGNED: { label: 'Driver Assigned', tone: 'brand' },
  IN_PROGRESS: { label: 'Collection in Progress', tone: 'brand' },
  COMPLETED: { label: 'Completed (+25 Credits)', tone: 'ok' },
  REJECTED: { label: 'Not Accommodated', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

const TIME_SLOT_LABELS = {
  MORNING: 'Morning (07:00 AM – 11:00 AM)',
  AFTERNOON: 'Afternoon (11:00 AM – 03:00 PM)',
  EVENING: 'Evening (03:00 PM – 07:00 PM)',
};

export default function MyScheduledRequests() {
  const t = useT();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ items: ScheduledPickupItem[] }>({
    queryKey: ['citizen', 'scheduled-pickups'],
    queryFn: async () => {
      const res = await api('citizen').get('/citizen/scheduled-pickup');
      return res.data;
    },
    refetchInterval: 10000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api('citizen').post(`/citizen/scheduled-pickup/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Scheduled pickup cancelled successfully.');
      queryClient.invalidateQueries({ queryKey: ['citizen', 'scheduled-pickups'] });
      setCancellingId(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setCancellingId(null);
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Title & CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-fluid-xl font-bold tracking-tight text-ink">My Scheduled Pickups</h1>
          <p className="text-fluid-xs text-muted">
            Track advance waste collection requests for events, society functions, and home renovations.
          </p>
        </div>

        <Link
          to="/app/schedule-pickup"
          className="btn-primary rounded-2xl px-4 py-2.5 text-fluid-xs font-bold shadow-md shadow-brand/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Scheduled Request</span>
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-fluid-xs font-medium">Loading your scheduled pickup history…</p>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <Card className="p-10 text-center border border-line bg-surface shadow-xs space-y-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand/10 text-brand">
            <Calendar className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-fluid-base font-bold text-ink">No Scheduled Pickups Yet</h3>
            <p className="text-fluid-xs text-muted max-w-md mx-auto">
              Planning a wedding, festival cleanup, or house renovation? Pre-schedule collection in advance so our compactor truck arrives on time.
            </p>
          </div>
          <Link
            to="/app/schedule-pickup"
            className="btn-primary inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-fluid-xs font-bold shadow-md shadow-brand/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Request First Scheduled Pickup</span>
          </Link>
        </Card>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => {
            const statusMeta = STATUS_CONFIG[item.status] || { label: item.status, tone: 'muted' as const };
            const dateObj = new Date(item.scheduledDate);
            const isUpcoming = dateObj.getTime() >= Date.now();
            const hoursUntil = Math.round((dateObj.getTime() - Date.now()) / 3600_000);
            const isWithin24h = isUpcoming && hoursUntil <= 24 && hoursUntil >= 0;

            const canCancel = ['PENDING_REVIEW', 'APPROVED_SCHEDULED'].includes(item.status);

            return (
              <Card key={item.id} className="p-5 border border-line bg-surface shadow-xs hover:shadow-sm transition space-y-4">
                {/* Header: Ticket Code & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-fluid-xs font-bold text-ink bg-sunken px-2.5 py-1 rounded-xl border border-line">
                      {item.code}
                    </span>
                    <span className="text-[11px] text-muted flex items-center gap-1">
                      {item.locationType === 'MY_HOME' ? <Home className="h-3.5 w-3.5 text-brand" /> : <Building2 className="h-3.5 w-3.5 text-brand" />}
                      {item.locationType === 'MY_HOME' ? 'Home' : 'Common Plot'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isWithin24h && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                        <Clock className="h-3 w-3" /> Pickup within {hoursUntil}h
                      </span>
                    )}
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                  </div>
                </div>

                {/* Main Body */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-8 space-y-2">
                    <h3 className="text-fluid-base font-bold text-ink">{item.eventReason}</h3>
                    <p className="text-fluid-xs text-muted flex items-start gap-1.5">
                      <MapPin className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span>{item.address}</span>
                    </p>

                    {/* Waste Categories & Load */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-ink mr-1">Load: {item.expectedQuantity}</span>
                      {(item.expectedCategories || []).map((cat) => (
                        <span key={cat} className="rounded-lg bg-sunken border border-line px-2 py-0.5 text-[10px] font-medium text-muted">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Target Slot Info Box */}
                  <div className="sm:col-span-4 rounded-2xl border border-line bg-sunken p-3 text-fluid-xs space-y-1.5 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 text-ink font-bold">
                      <Calendar className="h-4 w-4 text-brand" />
                      <span>{dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <p className="text-[11px] text-muted">{TIME_SLOT_LABELS[item.scheduledTimeSlot]}</p>
                    {item.ward && <p className="text-[10px] font-mono text-faint">Ward: {item.ward.name}</p>}
                  </div>
                </div>

                {/* Driver Info if Assigned */}
                {item.assignedDriver && (
                  <div className="rounded-2xl border border-brand/20 bg-brand/5 p-3 text-fluid-xs text-brand flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      <span>Assigned Driver: <strong>{item.assignedDriver.name}</strong> ({item.assignedDriver.phone})</span>
                    </div>
                    {item.assignedVehicle && (
                      <span className="font-mono text-[11px] font-bold text-ink">{item.assignedVehicle.registrationNumber}</span>
                    )}
                  </div>
                )}

                {/* Rejection Note */}
                {item.status === 'REJECTED' && item.rejectionReason && (
                  <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-fluid-xs text-danger flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Officer Note:</p>
                      <p className="text-[11px]">{item.rejectionReason}</p>
                    </div>
                  </div>
                )}

                {/* Completion Proof */}
                {item.status === 'COMPLETED' && (
                  <div className="rounded-2xl border border-ok/30 bg-ok/10 p-3 text-fluid-xs text-ok flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Waste Cleared & Verified (+25 Green Credits)
                    </span>
                    {item.completionPhotoUrl && (
                      <a href={item.completionPhotoUrl} target="_blank" rel="noreferrer" className="underline font-bold text-[11px]">
                        View Proof Photo
                      </a>
                    )}
                  </div>
                )}

                {/* Footer Actions */}
                {canCancel && (
                  <div className="flex justify-end pt-1 border-t border-line/40">
                    <button
                      type="button"
                      disabled={cancellingId === item.id || cancelMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to cancel scheduled request #${item.code}?`)) {
                          setCancellingId(item.id);
                          cancelMutation.mutate(item.id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-danger hover:text-danger/80 text-fluid-xs font-semibold px-2 py-1 rounded-lg hover:bg-danger/10 transition cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{cancellingId === item.id ? 'Cancelling…' : 'Cancel Request'}</span>
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
