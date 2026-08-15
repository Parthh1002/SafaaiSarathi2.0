import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPinned, Upload } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Card, ErrorState, Loading, Modal, SectionTitle, toast } from '../../components/ui';
import { BaseMap, WardLayer, FitBounds } from '../../components/map/Map';

/**
 * Ward boundary editor (plan §2.4). Accepts a GeoJSON Polygon or a Feature /
 * FeatureCollection containing one, computes the bbox and centroid server-side,
 * and re-attributes complaints on the next lookup.
 */
export default function WardSettings() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', code: '', zone: '', population: 0, slaMinutes: 1440, geojson: '' });

  const wards = useQuery({
    queryKey: ['admin', 'wards'],
    queryFn: async () => (await api('admin').get('/admin/wards')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      let parsed: any;
      try {
        parsed = JSON.parse(form.geojson);
      } catch {
        throw new Error('That is not valid JSON');
      }

      // Accept a bare Polygon, a Feature, or a one-feature FeatureCollection.
      const boundary =
        parsed.type === 'Polygon'
          ? parsed
          : parsed.type === 'Feature'
            ? parsed.geometry
            : parsed.type === 'FeatureCollection'
              ? parsed.features?.[0]?.geometry
              : null;

      if (!boundary || boundary.type !== 'Polygon') {
        throw new Error('Provide a GeoJSON Polygon (or a Feature containing one)');
      }

      return (
        await api('admin').post('/admin/wards', {
          id: form.id || undefined,
          name: form.name,
          code: form.code,
          zone: form.zone || undefined,
          population: Number(form.population) || 0,
          slaMinutes: Number(form.slaMinutes) || 1440,
          boundary,
        })
      ).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'wards'] });
      toast.success('Ward boundary saved');
      setUploading(false);
      setForm({ id: '', name: '', code: '', zone: '', population: 0, slaMinutes: 1440, geojson: '' });
    },
    onError: (err: any) => toast.error(err?.message || errorMessage(err)),
  });

  if (wards.isLoading) return <Loading />;
  if (wards.error) return <ErrorState message="Could not load wards" onRetry={() => wards.refetch()} />;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Ward settings"
        subtitle="Boundaries drive complaint attribution, officer scope and the heatmap"
        action={
          <button type="button" className="btn-primary btn-sm" onClick={() => setUploading(true)}>
            <Upload className="h-3.5 w-3.5" /> Upload boundary
          </button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="h-[46dvh] min-h-[300px] w-full">
          <BaseMap center={[23.2156, 72.6369]} zoom={12}>
            <FitBounds points={wards.data.map((w: any) => [w.center.latitude, w.center.longitude])} />
            <WardLayer wards={wards.data} colorFor={() => '#16a34a'} />
          </BaseMap>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {wards.data.map((w: any) => (
          <Card key={w.id} className="p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <MapPinned className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-fluid-sm font-semibold">{w.name}</p>
                <p className="truncate text-fluid-xs text-muted">{w.code} · {w.zone}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-fluid-xs">
              <div className="flex justify-between"><dt className="text-muted">Population</dt><dd className="tabular-nums">{w.population.toLocaleString('en-IN')}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Open complaints</dt><dd className="tabular-nums">{w.openComplaints}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Vehicles</dt><dd className="tabular-nums">{w.vehicles}</dd></div>
            </dl>
            <button
              type="button"
              className="btn-ghost btn-sm mt-3 w-full"
              onClick={() => {
                setForm({
                  id: w.id,
                  name: w.name,
                  code: w.code,
                  zone: w.zone,
                  population: w.population,
                  slaMinutes: 1440,
                  geojson: JSON.stringify(w.boundary, null, 2),
                });
                setUploading(true);
              }}
            >
              Edit boundary
            </button>
          </Card>
        ))}
      </div>

      <Modal
        open={uploading}
        onClose={() => setUploading(false)}
        title={form.id ? `Edit ${form.name}` : 'Add a ward'}
        wide
        footer={
          <button
            className="btn-primary w-full"
            disabled={!form.name || !form.code || !form.geojson || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Save ward
          </button>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="wname">Ward name</label>
              <input id="wname" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="wcode">Code</label>
              <input id="wcode" className="field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="W-09" />
            </div>
            <div>
              <label className="label" htmlFor="wzone">Zone</label>
              <input id="wzone" className="field" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="wpop">Population</label>
              <input
                id="wpop"
                type="number"
                className="field"
                value={form.population}
                onChange={(e) => setForm({ ...form, population: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="geo">GeoJSON boundary</label>
            <textarea
              id="geo"
              className="field min-h-[180px] resize-y py-2.5 font-mono text-fluid-xs"
              value={form.geojson}
              onChange={(e) => setForm({ ...form, geojson: e.target.value })}
              placeholder='{"type":"Polygon","coordinates":[[[72.80,21.15],[72.83,21.15],[72.83,21.18],[72.80,21.18],[72.80,21.15]]]}'
            />
            <p className="mt-1.5 text-fluid-xs text-muted">
              A Polygon, or a Feature / FeatureCollection containing one. Coordinates are [longitude, latitude].
            </p>
          </div>

          <label className="btn-ghost w-full cursor-pointer">
            <Upload className="h-4 w-4" /> Load from a .geojson file
            <input
              type="file"
              accept=".json,.geojson,application/geo+json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setForm({ ...form, geojson: await file.text() });
              }}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
