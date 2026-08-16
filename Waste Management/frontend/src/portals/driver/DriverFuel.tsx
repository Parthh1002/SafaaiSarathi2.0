import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Fuel,
  Gauge,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle2,
  Loader2,
  Plus,
  History,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, toast } from '../../components/ui';
import { timeAgo } from '../../lib/format';

export default function DriverFuel() {
  const queryClient = useQueryClient();

  const [liters, setLiters] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver', 'fuel-log'],
    queryFn: async () => (await api('driver').get('/driver/fuel-log')).data,
  });

  const submitLog = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (liters) payload.liters = Number(liters);
      if (odometerKm) payload.odometerKm = Number(odometerKm);
      if (cost) payload.cost = Number(cost);
      if (notes) payload.notes = notes;

      return (await api('driver').post('/driver/fuel-log', payload)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      toast.success('Fuel entry saved successfully!');
      setLiters('');
      setOdometerKm('');
      setCost('');
      setNotes('');
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save fuel log')),
  });

  if (isLoading) return <Loading label="Loading fuel records…" />;
  if (error) return <ErrorState message="Could not load fuel logs" onRetry={() => refetch()} />;

  const logs = data?.logs ?? [];
  const vehicleNumber = data?.registrationNumber || 'Assigned Truck';

  const totalLiters = logs.reduce((acc: number, l: any) => acc + (l.liters || 0), 0);
  const totalCost = logs.reduce((acc: number, l: any) => acc + (l.cost || 0), 0);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <Fuel className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-fluid-xl font-bold tracking-tight text-ink">Fuel & Odometer Log</h1>
            <p className="text-fluid-xs text-muted">
              Vehicle: <strong className="text-ink">{vehicleNumber}</strong> · Shift Trip Analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-line bg-elevated px-3 py-1.5 text-fluid-xs">
            <span className="text-muted">Total Pumped: </span>
            <span className="font-bold text-ink">{totalLiters.toFixed(1)} L</span>
          </div>
          <div className="rounded-xl border border-line bg-elevated px-3 py-1.5 text-fluid-xs">
            <span className="text-muted">Fuel Spend: </span>
            <span className="font-bold text-brand">₹{totalCost.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Responsive 2-Column Desktop Grid */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left Column: Entry Form (5 of 12 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 space-y-4 shadow-sm border-brand/20">
            <div className="flex items-center gap-2.5 border-b border-line pb-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-ink text-fluid-xs font-bold">
                +
              </span>
              <div>
                <h2 className="text-fluid-sm font-bold text-ink">New Refill / Trip Log</h2>
                <p className="text-fluid-xs text-muted">Log meter reading for automatic fuel reconciliation</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitLog.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="liters">
                    Fuel (Liters)
                  </label>
                  <div className="relative">
                    <input
                      id="liters"
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="field pr-8 text-fluid-sm font-semibold"
                      placeholder="e.g. 25"
                      value={liters}
                      onChange={(e) => setLiters(e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fluid-xs font-bold text-faint">
                      L
                    </span>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="odometer">
                    Odometer (Km)
                  </label>
                  <div className="relative">
                    <input
                      id="odometer"
                      type="number"
                      step="1"
                      min="0"
                      className="field pr-10 text-fluid-sm font-semibold"
                      placeholder="e.g. 45210"
                      value={odometerKm}
                      onChange={(e) => setOdometerKm(e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fluid-xs font-bold text-faint">
                      km
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="cost">
                  Total Amount Paid (₹ Optional)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fluid-sm font-bold text-faint">
                    ₹
                  </span>
                  <input
                    id="cost"
                    type="number"
                    step="1"
                    min="0"
                    className="field pl-8 text-fluid-sm"
                    placeholder="e.g. 2450"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="notes">
                  Station / Trip Note
                </label>
                <input
                  id="notes"
                  type="text"
                  className="field text-fluid-xs"
                  placeholder="e.g. Indian Oil Sector 11, Morning refill"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={(!liters && !odometerKm && !cost) || submitLog.isPending}
                className="btn-primary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-fluid-sm font-bold shadow-md"
              >
                {submitLog.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Save Fuel Entry
                  </>
                )}
              </button>
            </form>
          </Card>
        </div>

        {/* Right Column: Historical Logs & Fleet Fuel Table (7 of 12 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="overflow-hidden p-0 shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-sunken/40">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-brand" />
                <h3 className="text-fluid-xs font-bold uppercase tracking-wider text-muted">Recent Fuel Entries</h3>
              </div>
              <span className="text-[11px] font-semibold text-muted">{logs.length} logged records</span>
            </div>

            {!logs.length ? (
              <div className="p-8 text-center">
                <Fuel className="mx-auto h-8 w-8 text-faint" />
                <p className="mt-2 text-fluid-xs text-muted">No fuel entries logged yet for this shift.</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-4 hover:bg-sunken/40 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {log.liters && (
                          <Badge tone="brand" className="font-bold">
                            {log.liters} L
                          </Badge>
                        )}
                        {log.odometerKm && (
                          <span className="font-mono text-fluid-xs font-semibold text-ink">
                            {log.odometerKm.toLocaleString()} km
                          </span>
                        )}
                        <span className="text-[11px] text-muted">{timeAgo(log.loggedAt || log.createdAt)}</span>
                      </div>

                      {log.notes && <p className="text-fluid-xs text-muted italic">{log.notes}</p>}
                    </div>

                    {log.cost ? (
                      <span className="text-fluid-sm font-bold text-brand tabular-nums">
                        ₹{log.cost.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-fluid-xs text-faint">—</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
