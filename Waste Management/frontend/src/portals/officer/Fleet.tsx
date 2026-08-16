import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Phone, Route as RouteIcon, Truck, Wifi, WifiOff, Wrench, UserPlus } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, Modal, SectionTitle, toast } from '../../components/ui';
import { BaseMap, TruckMarker, RouteLine, PinMarker, FitBounds } from '../../components/map/Map';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';
import { timeAgo } from '../../lib/format';

/**
 * Fleet & driver registry (plan §2.3): every truck in the ward with its driver,
 * contact number, live status and current position — plus route optimisation
 * and publishing, which is where the day's plan actually gets made.
 */
export default function Fleet() {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<Record<string, any>>({});
  const [optimising, setOptimising] = useState<string | null>(null);
  const [plan, setPlan] = useState<any | null>(null);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', email: '', phone: '', password: '', wardId: '' });

  const createDriver = useMutation({
    mutationFn: async () =>
      (await api('officer').post('/officer/drivers', driverForm)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['officer', 'fleet'] });
      toast.success('Driver registered successfully');
      setCreatingDriver(false);
      setDriverForm({ name: '', email: '', phone: '', password: '', wardId: '' });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not register driver')),
  });

  const fleet = useQuery({
    queryKey: ['officer', 'fleet'],
    queryFn: async () => (await api('officer').get('/officer/fleet')).data,
    refetchInterval: 45_000,
  });
  const wards = useQuery({
    queryKey: ['officer', 'wards'],
    queryFn: async () => (await api('officer').get('/officer/wards')).data,
  });

  useSocket('officer', (wards.data ?? []).map((w: any) => `ward:${w.id}`), {
    [SOCKET_EVENTS.TRUCK_UPDATE]: (payload: any) => {
      if (payload?.id) setLive((prev) => ({ ...prev, [payload.id]: payload }));
    },
  });

  const optimise = useMutation({
    mutationFn: async (vehicleId: string) =>
      (await api('officer').post('/officer/routes/optimize', { vehicleId })).data,
    onSuccess: (data, vehicleId) => setPlan({ ...data, vehicleId }),
    onError: (err) => toast.error(errorMessage(err, 'Could not build a route')),
    onSettled: () => setOptimising(null),
  });

  const publish = useMutation({
    mutationFn: async () =>
      (
        await api('officer').post('/officer/routes/publish', {
          vehicleId: plan.vehicleId,
          stops: plan.stops,
          polyline: plan.polyline,
          distanceKm: plan.distanceKm,
          baselineKm: plan.baselineKm,
          savedKm: plan.savedKm,
          durationMin: plan.durationMin,
          fuelSaved: plan.fuelSaved,
          co2SavedKg: plan.co2SavedKg,
          solver: plan.solver,
          solveMs: plan.solveMs,
        })
      ).data,
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['officer'] });
      toast.success(`Route published — ${res.stops} stops sent to the driver`);
      setPlan(null);
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not publish the route')),
  });

  if (fleet.isLoading) return <Loading />;
  if (fleet.error) return <ErrorState message="Could not load the fleet" onRetry={() => fleet.refetch()} />;

  const vehicles = (fleet.data ?? []).map((v: any) => ({ ...v, ...(live[v.id] ?? {}) }));
  const positioned = vehicles.filter((v: any) => v.latitude != null);

  return (
    <div className="space-y-5">
      <SectionTitle 
        title="Fleet & drivers" 
        subtitle={`${vehicles.length} vehicles assigned to your wards`} 
        action={
          <button type="button" className="btn-primary btn-sm" onClick={() => setCreatingDriver(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Register Driver
          </button>
        }
      />

      {positioned.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="h-[38dvh] min-h-[260px] w-full">
            <BaseMap center={[positioned[0].latitude, positioned[0].longitude]} zoom={13}>
              <FitBounds points={positioned.map((v: any) => [v.latitude, v.longitude])} />
              {positioned.map((v: any) => (
                <TruckMarker
                  key={v.id}
                  latitude={v.latitude}
                  longitude={v.longitude}
                  heading={v.heading ?? 0}
                  active={v.status === 'ON_ROUTE'}
                  label={`${v.registrationNumber} · ${v.driver?.name ?? 'unassigned'}`}
                />
              ))}
            </BaseMap>
          </div>
        </Card>
      )}

      {vehicles.length === 0 ? (
        <EmptyState title="No vehicles assigned" hint="The Super Admin assigns vehicles to wards." icon={<Truck className="h-8 w-8" />} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v: any) => (
            <Card key={v.id} className="p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                    v.status === 'ON_ROUTE' ? 'bg-brand/10 text-brand' : 'bg-sunken text-muted'
                  }`}
                >
                  <Truck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-fluid-sm font-semibold">{v.registrationNumber}</p>
                  <p className="truncate text-fluid-xs text-muted">{v.model} · {v.capacityKg} kg</p>
                </div>
                <Badge tone={v.online ? 'ok' : 'neutral'}>
                  {v.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                  {v.online ? 'Live' : 'Offline'}
                </Badge>
              </div>

              <dl className="mt-3 space-y-1.5 text-fluid-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Driver</dt>
                  <dd className="min-w-0 truncate font-medium">{v.driver?.name ?? 'Unassigned'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Status</dt>
                  <dd><Badge tone={v.status === 'ON_ROUTE' ? 'ok' : v.status === 'MAINTENANCE' ? 'warn' : 'neutral'}>{v.status}</Badge></dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Open stops</dt>
                  <dd className="font-semibold tabular-nums">{v.assignedOpen}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Last ping</dt>
                  <dd>{v.lastPingAt ? timeAgo(v.lastPingAt) : '—'}</dd>
                </div>
              </dl>

              {v.maintenanceFlag && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-warn/30 bg-warn/10 p-2 text-fluid-xs text-warn">
                  <Wrench className="h-3.5 w-3.5" /> Flagged for maintenance
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {v.driver?.phone ? (
                  <a href={`tel:${v.driver.phone}`} className="btn-ghost btn-sm">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={optimising === v.id || v.maintenanceFlag}
                  onClick={() => {
                    setOptimising(v.id);
                    optimise.mutate(v.id);
                  }}
                >
                  {optimising === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RouteIcon className="h-3.5 w-3.5" />}
                  Plan route
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Optimisation preview — before/after saving, then publish. */}
      <Modal
        open={Boolean(plan)}
        onClose={() => setPlan(null)}
        title="Optimised route"
        wide
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPlan(null)}>Discard</button>
            <button type="button" className="btn-primary" disabled={publish.isPending} onClick={() => publish.mutate()}>
              {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RouteIcon className="h-4 w-4" />}
              Publish to driver
            </button>
          </div>
        }
      >
        {plan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Optimised" value={`${plan.distanceKm} km`} tone="ok" />
              <MiniStat label="Naive order" value={`${plan.baselineKm} km`} />
              <MiniStat label="Saved" value={`${plan.savedKm} km`} tone="ok" hint={`${plan.savedPct}%`} />
              <MiniStat label="Fuel saved" value={`₹${plan.fuelSaved}`} tone="ok" hint={`${plan.co2SavedKg} kg CO₂`} />
            </div>

            <div className="h-64 overflow-hidden rounded-xl border border-line">
              <BaseMap center={[plan.stops[0].latitude, plan.stops[0].longitude]} zoom={13}>
                <FitBounds points={plan.stops.map((s: any) => [s.latitude, s.longitude])} />
                <RouteLine polyline={plan.polyline} progressIndex={0} />
                {plan.stops.map((s: any) => (
                  <PinMarker
                    key={s.seq}
                    latitude={s.latitude}
                    longitude={s.longitude}
                    tone={s.isEmergency ? 'danger' : 'brand'}
                    label={`${s.seq}. ${s.label}`}
                  />
                ))}
              </BaseMap>
            </div>

            <div>
              <p className="label">Stop sequence — emergencies are pulled to the front</p>
              <ol className="space-y-1.5">
                {plan.stops.map((s: any) => (
                  <li key={s.seq} className="flex items-center gap-2.5 text-fluid-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sunken text-fluid-xs font-bold">
                      {s.seq}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {s.isEmergency && <Badge tone="danger">SOS</Badge>}
                    <span className="shrink-0 text-fluid-xs tabular-nums text-muted">{s.eta}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="text-fluid-xs text-faint">
              Solved by {plan.solver} in {plan.solveMs} ms · {plan.durationMin} min planned
            </p>
          </div>
        )}
      </Modal>

      {/* Driver Registration */}
      <Modal
        open={creatingDriver}
        onClose={() => setCreatingDriver(false)}
        title="Register a Driver"
        footer={
          <button
            className="btn-primary w-full"
            disabled={!driverForm.name || !driverForm.password || createDriver.isPending}
            onClick={() => createDriver.mutate()}
          >
            {createDriver.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Register Driver
          </button>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="dname">Full name</label>
            <input id="dname" className="field" value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="demail">Email (used for OTP verification)</label>
            <input id="demail" type="email" className="field" value={driverForm.email} onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="dphone">Phone</label>
            <input id="dphone" className="field" value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="dpass">Temporary Password</label>
            <input id="dpass" className="field" value={driverForm.password} onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="label">Ward</label>
            <div className="flex flex-wrap gap-1.5">
              {(wards.data ?? []).map((w: any) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setDriverForm({ ...driverForm, wardId: w.id })}
                  className={`chip transition ${driverForm.wardId === w.id ? 'border-brand bg-brand/10 text-brand' : 'text-muted hover:bg-sunken'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' }) {
  return (
    <div className="rounded-xl bg-sunken p-2.5">
      <p className="text-fluid-xs text-muted">{label}</p>
      <p className={`text-fluid-base font-bold tabular-nums ${tone === 'ok' ? 'text-ok' : ''}`}>{value}</p>
      {hint && <p className="text-fluid-xs text-faint">{hint}</p>}
    </div>
  );
}
