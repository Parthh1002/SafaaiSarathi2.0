import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fuel, Gauge, DollarSign, Calendar, FileText, CheckCircle2, Loader2, Plus, History } from 'lucide-react';
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-fluid-xl font-bold tracking-tight">Fuel & Odometer Tracker</h1>
        <p className="text-fluid-xs text-muted">
          Log fuel refills and odometer start/end for <strong className="text-ink">{vehicleNumber}</strong>
        </p>
      </div>

      {/* Fuel Log Form */}
      <Card className="p-4 space-y-3.5">
        <div className="flex items-center gap-2 border-b border-line pb-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
            <Fuel className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-fluid-sm font-bold">New Fuel / Trip Entry</h2>
            <p className="text-fluid-xs text-muted">Rolls up into shift analytics</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitLog.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="label" htmlFor="liters">Fuel Pumped (Liters)</label>
              <div className="relative">
                <input
                  id="liters"
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="field pr-8"
                  placeholder="e.g. 25"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fluid-xs text-faint">L</span>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="odometer">Odometer (km)</label>
              <div className="relative">
                <input
                  id="odometer"
                  type="number"
                  step="1"
                  min="0"
                  className="field pr-9"
                  placeholder="e.g. 45210"
                  value={odometerKm}
                  onChange={(e) => setOdometerKm(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fluid-xs text-faint">km</span>
              </div>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cost">Total Amount Paid (₹ optional)</label>
            <div className="relative">
              <input
                id="cost"
                type="number"
                step="1"
                min="0"
                className="field pl-7"
                placeholder="e.g. 2450"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fluid-xs text-faint">₹</span>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="notes">Station / Trip Note</label>
            <input
              id="notes"
              type="text"
              className="field"
              placeholder="e.g. Indian Oil Station, Shift start refill"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={(!liters && !odometerKm) || submitLog.isPending}
          >
            {submitLog.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Save Fuel Log
              </>
            )}
          </button>
        </form>
      </Card>

      {/* History List */}
      <div>
        <h2 className="mb-2.5 flex items-center gap-1.5 text-fluid-sm font-bold text-muted">
          <History className="h-4 w-4" /> Recent Fuel Entries
        </h2>

        {logs.length === 0 ? (
          <EmptyState
            title="No fuel entries yet"
            hint="Your refill records and odometer logs will be displayed here."
            icon={<Fuel className="h-7 w-7 text-muted" />}
          />
        ) : (
          <ul className="space-y-2.5">
            {logs.map((log: any) => (
              <li key={log.id}>
                <Card className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
                        <Fuel className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-fluid-sm font-bold">
                          {log.liters ? `${log.liters} Liters` : 'Odometer Check'}
                        </p>
                        <p className="text-fluid-xs text-muted">
                          {log.notes || 'Trip fuel logged'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {log.odometerKm && (
                        <p className="font-mono text-fluid-xs font-semibold text-ink">
                          {log.odometerKm.toLocaleString()} km
                        </p>
                      )}
                      {log.cost && (
                        <p className="text-fluid-xs font-semibold text-brand">
                          ₹{log.cost.toLocaleString()}
                        </p>
                      )}
                      <p className="text-fluid-xs text-faint">
                        {timeAgo(log.loggedAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
