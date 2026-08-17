import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Navigation,
  MapPin,
  Route as RouteIcon,
  Fuel,
  Clock,
  CheckCircle2,
  ArrowRight,
  Truck,
  ShieldAlert,
  Compass,
  Phone,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading } from '../../components/ui';
import RoadSnappedMap from '../../components/map/RoadSnappedMap';
import { mockFleetEngine, SimulatedDriver } from '../../lib/mockFleetEngine';
import { useT } from '../../lib/i18n';

export default function DriverRoute() {
  const t = useT();
  const [drivers, setDrivers] = useState<SimulatedDriver[]>([]);
  const [myDriverId, setMyDriverId] = useState<string>('drv-01');

  // Connect to the shared fleet engine (or WebSocket GPS feed)
  useEffect(() => {
    const unsubscribe = mockFleetEngine.subscribe((updatedList) => {
      setDrivers([...updatedList]);
    });
    return () => unsubscribe();
  }, []);

  const currentDriver = drivers.find((d) => d.id === myDriverId) || drivers[0];

  return (
    <div className="space-y-4">
      {/* Top Banner / Route Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
              <Navigation className="h-4 w-4" />
            </span>
            <h1 className="text-fluid-lg font-extrabold text-ink tracking-tight">
              Live Road Navigation
            </h1>
          </div>
          <p className="text-fluid-xs text-muted">
            OSRM road-snapped turn-by-turn routing with real-time street tracking
          </p>
        </div>

        {/* Driver Selector for Testing Multiple Driver Routes */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-muted uppercase">Active Vehicle:</span>
          <select
            value={myDriverId}
            onChange={(e) => setMyDriverId(e.target.value)}
            className="field py-1.5 px-3 text-fluid-xs font-semibold rounded-xl border border-line bg-surface cursor-pointer"
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.vehicleNumber}) - {d.wardCode}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Full-Screen Road-Snapped Driver Navigation Map */}
      <div className="relative h-[65dvh] min-h-[420px] w-full overflow-hidden rounded-3xl border border-line shadow-lg">
        {drivers.length > 0 ? (
          <RoadSnappedMap
            mode="single-driver"
            drivers={drivers}
            activeDriverId={myDriverId}
          />
        ) : (
          <Loading label="Snapping route to road network…" />
        )}
      </div>

      {/* Driver Assignment & Stop Details */}
      {currentDriver && (
        <Card className="p-4 border-line shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs">
                <Truck className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Assigned Waste Destination
                </span>
                <h3 className="text-fluid-base font-bold text-ink leading-tight">
                  {currentDriver.destination.name}
                </h3>
                <p className="text-fluid-xs text-muted">{currentDriver.destination.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone={currentDriver.destination.urgency === 'EMERGENCY' ? 'danger' : 'brand'}>
                {currentDriver.destination.category}
              </Badge>
              <Badge tone="ok">
                ETA: {currentDriver.etaMinutes} mins
              </Badge>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
