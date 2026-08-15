import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Truck, Wifi, WifiOff, Wrench } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, Modal, SectionTitle, toast } from '../../components/ui';
import { timeAgo } from '../../lib/format';

/** Master fleet registry (plan §2.4) — every registered vehicle in the city. */
export default function MasterFleet() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ registrationNumber: '', wardId: '', driverId: '', model: 'Tata Ace', capacityKg: 2000 });

  const fleet = useQuery({
    queryKey: ['admin', 'fleet'],
    queryFn: async () => (await api('admin').get('/admin/fleet')).data,
    refetchInterval: 60_000,
  });
  const wards = useQuery({
    queryKey: ['admin', 'wards'],
    queryFn: async () => (await api('admin').get('/admin/wards')).data,
  });
  const drivers = useQuery({
    queryKey: ['admin', 'users', 'DRIVER'],
    queryFn: async () => (await api('admin').get('/admin/users', { params: { role: 'DRIVER', pageSize: 100 } })).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await api('admin').post('/admin/fleet', {
          registrationNumber: form.registrationNumber,
          wardId: form.wardId || undefined,
          driverId: form.driverId || undefined,
          model: form.model,
          capacityKg: Number(form.capacityKg),
        })
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'fleet'] });
      toast.success('Vehicle registered');
      setAdding(false);
      setForm({ registrationNumber: '', wardId: '', driverId: '', model: 'Tata Ace', capacityKg: 2000 });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) =>
      (await api('admin').patch(`/admin/fleet/${id}`, patch)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'fleet'] });
      toast.success('Vehicle updated');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (fleet.isLoading) return <Loading />;
  if (fleet.error) return <ErrorState message="Could not load the fleet" onRetry={() => fleet.refetch()} />;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Master fleet registry"
        subtitle={`${fleet.data.length} vehicles across the city`}
        action={
          <button type="button" className="btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Register vehicle
          </button>
        }
      />

      <Card className="hidden overflow-hidden p-0 lg:block">
        <div className="table-scroll">
          <table className="w-full min-w-[60rem] text-left text-fluid-sm">
            <thead className="border-b border-line bg-sunken/60 text-fluid-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Registration</th>
                <th className="px-4 py-2.5">Driver</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Ward</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">GPS</th>
                <th className="px-4 py-2.5">Last ping</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {fleet.data.map((v: any) => (
                <tr key={v.id} className="hover:bg-sunken/50">
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-medium">{v.registrationNumber}</span>
                    <p className="text-fluid-xs text-muted">{v.model} · {v.capacityKg} kg</p>
                  </td>
                  <td className="px-4 py-2.5">{v.driver?.name ?? <span className="text-faint">Unassigned</span>}</td>
                  <td className="px-4 py-2.5">
                    {v.driver?.phone ? (
                      <a href={`tel:${v.driver.phone}`} className="font-mono text-fluid-xs text-brand hover:underline">
                        {v.driver.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5">{v.ward?.name ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={v.status === 'ON_ROUTE' ? 'ok' : v.status === 'MAINTENANCE' ? 'warn' : 'neutral'}>
                      {v.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {v.online ? (
                      <span className="inline-flex items-center gap-1 text-fluid-xs text-ok"><Wifi className="h-3.5 w-3.5" /> Live</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-fluid-xs text-faint"><WifiOff className="h-3.5 w-3.5" /> Offline</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-fluid-xs text-muted">{v.lastPingAt ? timeAgo(v.lastPingAt) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => update.mutate({ id: v.id, patch: { maintenanceFlag: !v.maintenanceFlag } })}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      {v.maintenanceFlag ? 'Clear flag' : 'Flag'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile / tablet cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {fleet.data.map((v: any) => (
          <Card key={v.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <Truck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-fluid-sm font-semibold">{v.registrationNumber}</p>
                <p className="truncate text-fluid-xs text-muted">{v.driver?.name ?? 'Unassigned'} · {v.ward?.name ?? 'No ward'}</p>
              </div>
              <Badge tone={v.online ? 'ok' : 'neutral'}>{v.online ? 'Live' : 'Offline'}</Badge>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone={v.status === 'ON_ROUTE' ? 'ok' : v.status === 'MAINTENANCE' ? 'warn' : 'neutral'}>{v.status}</Badge>
              {v.driver?.phone && (
                <a href={`tel:${v.driver.phone}`} className="btn-ghost btn-sm ml-auto">Call</a>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Register a vehicle"
        footer={
          <button
            className="btn-primary w-full"
            disabled={!form.registrationNumber || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Register
          </button>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="reg">Registration number</label>
            <input
              id="reg"
              className="field font-mono"
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value.toUpperCase() })}
              placeholder="GJ 05 AB 1234"
            />
          </div>
          <div>
            <label className="label" htmlFor="model">Model</label>
            <input id="model" className="field" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="cap">Capacity (kg)</label>
            <input
              id="cap"
              type="number"
              className="field"
              value={form.capacityKg}
              onChange={(e) => setForm({ ...form, capacityKg: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label" htmlFor="ward">Ward</label>
            <select id="ward" className="field" value={form.wardId} onChange={(e) => setForm({ ...form, wardId: e.target.value })}>
              <option value="">Unassigned</option>
              {(wards.data ?? []).map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="driver">Driver</label>
            <select id="driver" className="field" value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">Unassigned</option>
              {(drivers.data?.items ?? []).map((d: any) => (
                <option key={d.id} value={d.id}>{d.name} · {d.phone}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
