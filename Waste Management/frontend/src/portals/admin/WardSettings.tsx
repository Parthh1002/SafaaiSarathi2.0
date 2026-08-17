import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  MapPinned,
  Upload,
  Plus,
  Trash2,
  Layers,
  Check,
  X,
  Crosshair,
  FileCode,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Sparkles,
  RotateCw,
  HelpCircle,
  Undo2,
  Redo2,
} from 'lucide-react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, SectionTitle, toast } from '../../components/ui';
import { BaseMap, WardLayer, FitBounds, GANDHINAGAR } from '../../components/map/Map';

interface Point {
  lat: number;
  lng: number;
}

// Custom draggable corner handle icon (High visibility White/Emerald circle with large 34px touch/click target)
function createVertexIcon(index: number) {
  return L.divIcon({
    className: 'custom-vertex-handle-container',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div style="
      width: 32px;
      height: 32px;
      background: radial-gradient(circle at 30% 30%, #ffffff, #f1f5f9);
      border: 4px solid #059669;
      border-radius: 9999px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.7), 0 0 0 2px rgba(255,255,255,0.9);
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 900;
      color: #064e3b;
      user-select: none;
      pointer-events: auto;
      touch-action: none;
    ">#${index + 1}</div>`,
  });
}

/** Leaflet Map Event Listener to add points on click */
function MapClickHandler({ onAddPoint }: { onAddPoint: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onAddPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Auto fit map view to points */
function MapFitPolygon({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [map]);
  return null;
}

/** Dedicated Draggable Vertex Marker to maintain smooth Leaflet native mouse drag sessions */
function DraggableVertexMarker({
  index,
  point,
  onPositionChange,
  onDragStart,
  isPermanentTooltip = false,
}: {
  index: number;
  point: Point;
  onPositionChange: (index: number, lat: number, lng: number) => void;
  onDragStart?: () => void;
  isPermanentTooltip?: boolean;
}) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragstart() {
        if (onDragStart) onDragStart();
      },
      drag(e: any) {
        const marker = e.target;
        if (marker) {
          const latlng = marker.getLatLng();
          onPositionChange(index, latlng.lat, latlng.lng);
        }
      },
      dragend(e: any) {
        const marker = e.target;
        if (marker) {
          const latlng = marker.getLatLng();
          onPositionChange(index, latlng.lat, latlng.lng);
        }
      },
    }),
    [index, onPositionChange, onDragStart]
  );

  return (
    <Marker
      ref={markerRef}
      position={[point.lat, point.lng]}
      icon={createVertexIcon(index)}
      draggable={true}
      autoPan={true}
      zIndexOffset={2000}
      eventHandlers={eventHandlers}
    >
      <Tooltip
        direction="top"
        offset={[0, -18]}
        opacity={0.95}
        permanent={isPermanentTooltip}
        interactive={false}
        className="pointer-events-none select-none"
      >
        <div className="text-center font-sans py-0.5 pointer-events-none">
          <strong className="text-emerald-700 font-bold block">Point #{index + 1}</strong>
          <span className="text-[10px] text-slate-700 font-mono block">
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </span>
        </div>
      </Tooltip>
    </Marker>
  );
}

export default function WardSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [form, setForm] = useState({
    id: '',
    name: '',
    code: '',
    zone: '',
    population: 0,
    slaMinutes: 1440,
  });
  const [points, setPoints] = useState<Point[]>([
    { lat: 23.196603, lng: 72.59669 },
    { lat: 23.197304, lng: 72.60610 },
    { lat: 23.197157, lng: 72.615923 },
    { lat: 23.206223, lng: 72.616277 },
  ]);

  // Undo & Redo History State Stacks
  const [history, setHistory] = useState<Point[][]>([]);
  const [future, setFuture] = useState<Point[][]>([]);

  const recordHistorySnapshot = () => {
    setHistory((prev) => [...prev.slice(-30), points.map((p) => ({ ...p }))]);
    setFuture([]);
  };

  const handleUndo = () => {
    if (history.length === 0) {
      toast.info('No more steps to undo');
      return;
    }
    const previous = history[history.length - 1];
    setFuture((prev) => [points.map((p) => ({ ...p })), ...prev]);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setPoints(previous);
    toast.info('↺ Undo: Reverted boundary change');
  };

  const handleRedo = () => {
    if (future.length === 0) {
      toast.info('No more steps to redo');
      return;
    }
    const next = future[0];
    setHistory((prev) => [...prev, points.map((p) => ({ ...p }))]);
    setFuture((prev) => prev.slice(1));
    setPoints(next);
    toast.info('↻ Redo: Reapplied boundary change');
  };

  // Handle ESC key to exit fullscreen map mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreenMap) {
          setIsFullscreenMap(false);
        } else if (modalOpen) {
          setModalOpen(false);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenMap, modalOpen, history, future, points]);

  const wards = useQuery({
    queryKey: ['admin', 'wards'],
    queryFn: async () => (await api('admin').get('/admin/wards')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (points.length < 3) {
        throw new Error('At least 3 boundary points are required to form a ward area.');
      }

      // Construct standard GeoJSON Polygon: coordinates is [ [ [lng, lat], ... , [lng, lat] ] ]
      const ring = points.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
      // Close the polygon ring if not already closed
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push([...ring[0]]);
      }

      const boundary = {
        type: 'Polygon',
        coordinates: [ring],
      };

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
      toast.success('Ward boundary saved successfully');
      setModalOpen(false);
      setIsFullscreenMap(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || errorMessage(err)),
  });

  const resetForm = () => {
    setForm({ id: '', name: '', code: '', zone: '', population: 0, slaMinutes: 1440 });
    setHistory([]);
    setFuture([]);
    setPoints([
      { lat: 23.196603, lng: 72.59669 },
      { lat: 23.197304, lng: 72.60610 },
      { lat: 23.197157, lng: 72.615923 },
      { lat: 23.206223, lng: 72.616277 },
    ]);
  };

  const openEditModal = (w: any) => {
    setForm({
      id: w.id,
      name: w.name,
      code: w.code,
      zone: w.zone || '',
      population: w.population || 0,
      slaMinutes: w.slaMinutes || 1440,
    });
    setHistory([]);
    setFuture([]);

    // Extract coordinates from boundary GeoJSON
    try {
      const ring = w.boundary?.coordinates?.[0] || [];
      if (ring.length >= 3) {
        // Exclude duplicate last closure point for interactive editor
        const pts: Point[] = ring.slice(0, -1).map(([lng, lat]: [number, number]) => ({
          lat: Number(lat),
          lng: Number(lng),
        }));
        setPoints(pts.length >= 3 ? pts : ring.map(([lng, lat]: [number, number]) => ({ lat: Number(lat), lng: Number(lng) })));
      }
    } catch {
      // Keep default points if malformed
    }
    setModalOpen(true);
  };

  const handlePointDrag = (index: number, newLat: number, newLng: number) => {
    setPoints((prev) => {
      const copy = [...prev];
      copy[index] = { lat: Number(newLat.toFixed(6)), lng: Number(newLng.toFixed(6)) };
      return copy;
    });
  };

  const handlePointChange = (index: number, field: 'lat' | 'lng', val: string) => {
    recordHistorySnapshot();
    const num = parseFloat(val);
    setPoints((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: isNaN(num) ? 0 : num,
      };
      return copy;
    });
  };

  const handleAddPoint = (lat?: number, lng?: number) => {
    recordHistorySnapshot();
    if (lat !== undefined && lng !== undefined) {
      setPoints((prev) => [...prev, { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }]);
      toast.info(`Added Point ${points.length + 1} at Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
    } else {
      // Add point near centroid
      const center = centerCoord;
      setPoints((prev) => [...prev, { lat: Number((center[0] + 0.002).toFixed(6)), lng: Number((center[1] + 0.002).toFixed(6)) }]);
      toast.info(`Added Point ${points.length + 1}`);
    }
  };

  const handleDeletePoint = (index: number) => {
    if (points.length <= 3) {
      toast.warn('A ward boundary requires at least 3 points.');
      return;
    }
    recordHistorySnapshot();
    setPoints((prev) => prev.filter((_, i) => i !== index));
    toast.info(`Deleted Point #${index + 1}`);
  };

  /** Sorts points clockwise around their center of mass to fix crossed/hourglass boundaries */
  const handleSortPerimeter = () => {
    if (points.length < 3) return;
    recordHistorySnapshot();
    const center = centerCoord;
    const sorted = [...points].sort((a, b) => {
      const angleA = Math.atan2(a.lat - center[0], a.lng - center[1]);
      const angleB = Math.atan2(b.lat - center[0], b.lng - center[1]);
      return angleA - angleB;
    });
    setPoints(sorted);
    toast.success('Cleaned up polygon perimeter geometry!');
  };

  const handleGeoJsonUpload = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const boundary =
        parsed.type === 'Polygon'
          ? parsed
          : parsed.type === 'Feature'
          ? parsed.geometry
          : parsed.type === 'FeatureCollection'
          ? parsed.features?.[0]?.geometry
          : null;

      if (!boundary || boundary.type !== 'Polygon' || !boundary.coordinates?.[0]) {
        toast.error('Invalid GeoJSON Polygon file');
        return;
      }

      const ring = boundary.coordinates[0];
      const pts: Point[] = ring.slice(0, -1).map(([lng, lat]: [number, number]) => ({
        lat: Number(lat),
        lng: Number(lng),
      }));

      setPoints(pts);
      toast.success(`Loaded ${pts.length} boundary points from GeoJSON`);
    } catch {
      toast.error('Failed to parse GeoJSON file');
    }
  };

  const centerCoord = useMemo<[number, number]>(() => {
    if (points.length === 0) return GANDHINAGAR;
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return [avgLat, avgLng];
  }, [points]);

  if (wards.isLoading) return <Loading label="Loading Municipal Wards…" />;
  if (wards.error) return <ErrorState message="Could not load wards" onRetry={() => wards.refetch()} />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <SectionTitle
        title="Ward settings"
        subtitle="Boundaries drive complaint attribution, officer scope, routing, and spatial heatmaps"
        action={
          <button
            type="button"
            className="btn-primary btn-sm flex items-center gap-2 shadow-xs cursor-pointer"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add a ward
          </button>
        }
      />

      {/* Main Ward Overview Map */}
      <Card className="overflow-hidden p-0 border-line shadow-xs">
        <div className="h-[46dvh] min-h-[320px] w-full relative">
          <BaseMap center={[23.2156, 72.6369]} zoom={12}>
            <FitBounds points={wards.data.map((w: any) => [w.center.latitude, w.center.longitude])} />
            <WardLayer wards={wards.data} colorFor={() => '#16a34a'} />
          </BaseMap>
        </div>
      </Card>

      {/* Ward Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {wards.data.map((w: any) => (
          <Card key={w.id} className="p-4 border-line shadow-xs hover:shadow-md transition">
            <div className="flex items-start gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <MapPinned className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-fluid-sm font-bold text-ink">{w.name}</p>
                <p className="truncate text-fluid-xs text-muted">
                  {w.code} · {w.zone || 'Central Zone'}
                </p>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-fluid-xs">
              <div className="flex justify-between border-b border-line/40 pb-1">
                <dt className="text-muted">Population</dt>
                <dd className="tabular-nums font-semibold text-ink">{w.population.toLocaleString('en-IN')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1">
                <dt className="text-muted">Open Complaints</dt>
                <dd className="tabular-nums font-semibold text-ink">{w.openComplaints}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Assigned Vehicles</dt>
                <dd className="tabular-nums font-semibold text-brand">{w.vehicles}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="btn-ghost btn-sm mt-3.5 w-full font-semibold border border-line cursor-pointer hover:bg-brand/10 hover:text-brand"
              onClick={() => openEditModal(w)}
            >
              Edit boundary
            </button>
          </Card>
        ))}
      </div>

      {/* Interactive Ward Boundary Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col bg-elevated rounded-3xl border border-line shadow-2xl overflow-hidden animate-sheet-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-surface/80">
              <div>
                <h2 className="text-fluid-base font-bold text-ink leading-tight">
                  {form.id ? `Edit ${form.name}` : 'Add a ward'}
                </h2>
                <p className="text-[11px] text-muted font-mono">{form.code || 'New Ward Registration'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setIsFullscreenMap(false);
                }}
                className="p-1.5 text-muted hover:text-ink hover:bg-sunken rounded-xl transition cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1 custom-scrollbar">
              
              {/* Row 1: Ward Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">
                    WARD NAME
                  </label>
                  <input
                    className="field font-medium text-fluid-sm py-2.5 rounded-xl border border-line bg-surface"
                    value={form.name}
                    placeholder="e.g. Sector 1–7"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">
                    CODE
                  </label>
                  <input
                    className="field font-medium text-fluid-sm py-2.5 rounded-xl border border-line bg-surface font-mono"
                    value={form.code}
                    placeholder="W-01"
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 2: Zone & Population */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">
                    ZONE
                  </label>
                  <input
                    className="field font-medium text-fluid-sm py-2.5 rounded-xl border border-line bg-surface"
                    value={form.zone}
                    placeholder="North Zone"
                    onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">
                    POPULATION
                  </label>
                  <input
                    type="number"
                    className="field font-medium text-fluid-sm py-2.5 rounded-xl border border-line bg-surface tabular-nums"
                    value={form.population || ''}
                    placeholder="41000"
                    onChange={(e) => setForm({ ...form, population: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Section Header: Boundary Coordinates */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink mb-0.5">
                    BOUNDARY COORDINATES
                  </h3>
                  <p className="text-fluid-xs text-muted">
                    Click the map to drop a point, or drag the numbered corner handles. At least 3 points are needed.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSortPerimeter}
                  className="btn-ghost btn-sm text-[11px] font-bold gap-1 border border-line cursor-pointer hover:bg-brand/10 hover:text-brand"
                  title="Automatically fix crossed polygon boundaries"
                >
                  <RotateCw className="h-3 w-3 text-brand" /> Fix Perimeter
                </button>
              </div>

              {/* Interactive Draggable Leaflet Map Container */}
              <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-2xl border border-line shadow-inner bg-slate-950">
                <MapContainer
                  center={centerCoord}
                  zoom={14}
                  scrollWheelZoom={true}
                  className="h-full w-full"
                  preferCanvas
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {/* Polygon shape with non-blocking interactive=false */}
                  {points.length >= 3 && (
                    <Polygon
                      positions={points.map((p) => [p.lat, p.lng])}
                      interactive={false}
                      pathOptions={{
                        color: '#16a34a',
                        fillColor: '#16a34a',
                        fillOpacity: 0.28,
                        weight: 2.5,
                      }}
                    />
                  )}

                  {/* Draggable Vertex Handles at each corner using dedicated uncoupled drag session */}
                  {points.map((pt, idx) => (
                    <DraggableVertexMarker
                      key={`modal-vertex-${idx}`}
                      index={idx}
                      point={pt}
                      onPositionChange={handlePointDrag}
                      onDragStart={recordHistorySnapshot}
                    />
                  ))}

                  <MapClickHandler onAddPoint={handleAddPoint} />
                  <MapFitPolygon points={points} />
                </MapContainer>

                {/* Top Overlay Controls: Fullscreen Expand, Undo/Redo & Tip Badge */}
                <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white tracking-wide border border-white/20 flex items-center gap-1.5 shadow-md">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Drag dots or click to add
                    </div>

                    {/* Quick Undo & Redo Buttons */}
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={history.length === 0}
                      className="bg-black/80 hover:bg-black text-white p-1.5 rounded-lg border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition cursor-pointer"
                      title="Undo last change (Ctrl+Z)"
                    >
                      <Undo2 className="h-3.5 w-3.5 text-emerald-400" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={future.length === 0}
                      className="bg-black/80 hover:bg-black text-white p-1.5 rounded-lg border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition cursor-pointer"
                      title="Redo change (Ctrl+Y)"
                    >
                      <Redo2 className="h-3.5 w-3.5 text-emerald-400" />
                    </button>
                  </div>

                  {/* Expand to Full Screen Map Button */}
                  <button
                    type="button"
                    onClick={() => setIsFullscreenMap(true)}
                    className="pointer-events-auto bg-emerald-700 hover:bg-emerald-800 text-white p-2 rounded-xl shadow-lg border border-emerald-500/50 flex items-center gap-1.5 text-xs font-bold transition cursor-pointer"
                    title="Open Fullscreen Boundary Editor"
                  >
                    <Maximize2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Fullscreen Map</span>
                  </button>
                </div>
              </div>

              {/* Numbered Coordinate Rows List */}
              <div className="space-y-2.5">
                {points.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    {/* Step Number Badge */}
                    <span className="text-fluid-xs font-mono font-bold text-muted w-5 text-center">
                      {idx + 1}
                    </span>

                    {/* Latitude Input */}
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-muted block mb-0.5">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={pt.lat}
                        onChange={(e) => handlePointChange(idx, 'lat', e.target.value)}
                        className="field font-mono text-xs w-full py-1.5"
                        placeholder="23.2156"
                        required
                      />
                    </div>

                    {/* Longitude Input */}
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-muted block mb-0.5">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={pt.lng}
                        onChange={(e) => handlePointChange(idx, 'lng', e.target.value)}
                        className="field font-mono text-xs w-full py-1.5"
                        placeholder="72.6369"
                        required
                      />
                    </div>

                    {/* Delete Point Button */}
                    <button
                      type="button"
                      onClick={() => handleDeletePoint(idx)}
                      disabled={points.length <= 3}
                      className="self-end mb-1 p-2 rounded-xl border border-line bg-surface text-muted hover:text-red-600 hover:border-red-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                      title={points.length <= 3 ? 'Minimum 3 points required' : 'Delete this corner'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Point Row Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddPoint()}
                    className="btn btn-outline text-xs py-1.5 px-3 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add point</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSortPerimeter}
                    className="btn btn-outline text-xs py-1.5 px-3 flex items-center gap-1 cursor-pointer"
                    title="Uncross and fix boundary perimeter"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Fix Perimeter</span>
                  </button>
                </div>

                <label
                  htmlFor="geojson-upload"
                  className="btn btn-outline text-xs py-1.5 px-3 flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import GeoJSON</span>
                  <input
                    id="geojson-upload"
                    type="file"
                    accept=".json,.geojson"
                    onChange={handleGeoJsonImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Modal Sticky Bottom Footer with Solid Green Save Button */}
            <div className="border-t border-line px-6 py-4 bg-surface/90">
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={!form.name || !form.code || points.length < 3 || save.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-fluid-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>Save ward</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMMERSIVE FULLSCREEN MAP BOUNDARY EDITOR (ESC to Exit / Minimize)        */}
      {/* ========================================================================= */}
      {isFullscreenMap && (
        <div className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950 flex flex-col animate-fade-in select-none">
          
          {/* Top Fullscreen Floating Toolbar */}
          <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
            
            {/* Ward Info & Points Counter with High-Contrast Green Text Highlights */}
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-black/95 border border-emerald-500/50 px-4 py-2.5 text-white shadow-2xl backdrop-blur-xl">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white font-bold shadow-md">
                <MapPinned className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-fluid-sm font-extrabold text-white tracking-tight leading-tight">
                    {form.name || 'Sector 1–7'}
                  </h3>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase font-mono">
                    {form.code || 'W-01'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                  🟢 {form.zone || 'North Zone'} Municipal Ward Section · {points.length} Corner Vertices Active
                </p>
              </div>
            </div>

            {/* Quick Actions & Undo/Redo & Minimize / Exit (ESC) */}
            <div className="pointer-events-auto flex items-center gap-2">
              
              {/* Undo & Redo Tool Buttons */}
              <div className="flex items-center gap-1 bg-black/90 border border-slate-700 p-1 rounded-2xl shadow-xl">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Undo last action (Ctrl+Z)"
                >
                  <Undo2 className="h-4 w-4 text-emerald-400" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Redo action (Ctrl+Y)"
                >
                  <Redo2 className="h-4 w-4 text-emerald-400" />
                  <span className="hidden sm:inline">Redo</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSortPerimeter}
                className="flex items-center gap-1.5 rounded-2xl bg-black/90 border border-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-200 shadow-xl hover:bg-slate-800 transition cursor-pointer"
                title="Uncross and fix boundary perimeter"
              >
                <RotateCw className="h-4 w-4 text-emerald-400" />
                <span>Fix Perimeter</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddPoint()}
                className="flex items-center gap-1.5 rounded-2xl bg-emerald-700 border border-emerald-500/50 px-3.5 py-2.5 text-xs font-bold text-white shadow-xl hover:bg-emerald-800 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Point</span>
              </button>

              {/* Minimize / Exit Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsFullscreenMap(false)}
                className="flex items-center gap-2 rounded-2xl bg-red-600/95 hover:bg-red-700 border border-red-500/50 px-4 py-2.5 text-xs font-bold text-white shadow-2xl transition cursor-pointer"
                title="Press ESC or Click to Exit Fullscreen"
              >
                <Minimize2 className="h-4 w-4" />
                <span>Minimize (ESC)</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Map Canvas */}
          <div className="h-full w-full relative">
            <MapContainer
              center={centerCoord}
              zoom={15}
              scrollWheelZoom={true}
              className="h-full w-full"
              preferCanvas
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
              />

              {/* Fullscreen Polygon with non-blocking interactive=false */}
              {points.length >= 3 && (
                <Polygon
                  positions={points.map((p) => [p.lat, p.lng])}
                  interactive={false}
                  pathOptions={{
                    color: '#10b981',
                    fillColor: '#10b981',
                    fillOpacity: 0.32,
                    weight: 3.5,
                  }}
                />
              )}

              {/* Draggable Vertex Handles with Numbered Tooltips using dedicated uncoupled drag session */}
              {points.map((pt, idx) => (
                <DraggableVertexMarker
                  key={`fullscreen-vertex-${idx}`}
                  index={idx}
                  point={pt}
                  onPositionChange={handlePointDrag}
                  onDragStart={recordHistorySnapshot}
                  isPermanentTooltip={true}
                />
              ))}

              <MapClickHandler onAddPoint={handleAddPoint} />
            </MapContainer>
          </div>

          {/* Bottom Floating Quick Save HUD */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-slate-900/95 border border-slate-700/80 p-2 rounded-2xl shadow-2xl backdrop-blur-xl">
            <div className="px-3 text-xs text-slate-300 font-medium">
              Click anywhere on map to drop new points · Drag numbers to reshape
            </div>

            <button
              type="button"
              onClick={() => {
                setIsFullscreenMap(false);
                save.mutate();
              }}
              disabled={points.length < 3 || save.isPending}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>Save & Done</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
