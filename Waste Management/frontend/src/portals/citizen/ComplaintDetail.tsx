import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Check, MapPin, Sparkles, Truck, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, Meter } from '../../components/ui';
import { BackLink } from '../../components/shells';
import { BaseMap, PinMarker } from '../../components/map/Map';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONE, formatDateTime, timeAgo } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';

const FLOW = ['PENDING', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

export default function ComplaintDetail() {
  const t = useT();
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['citizen', 'complaint', id],
    queryFn: async () => (await api('citizen').get(`/citizen/complaints/${id}`)).data,
    enabled: Boolean(id),
  });

  // Live status changes without a refresh.
  useSocket('citizen', id ? [`complaint:${id}`] : [], {
    [SOCKET_EVENTS.COMPLAINT_UPDATE]: () => refetch(),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message="Could not load this report" onRetry={() => refetch()} />;

  const currentIndex = FLOW.indexOf(data.status);
  const rejected = data.status === 'REJECTED';

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <BackLink to="/app/complaints" label="My reports" />

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-fluid-xl font-bold tracking-tight">{t(`category.${data.category}`)}</h1>
        {data.isEmergency && <Badge tone="danger">Emergency</Badge>}
      </div>
      <p className="-mt-2 font-mono text-fluid-xs text-muted">{data.code}</p>

      {/* Before & After Photo Comparison */}
      {(data.photoUrl || data.resolutionPhotoUrl) && (
        <Card className="overflow-hidden p-0 border-line shadow-sm">
          <div className="border-b border-line bg-sunken px-4 py-2.5 flex items-center justify-between">
            <span className="text-fluid-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand" /> Visual Resolution Evidence
            </span>
            <Badge tone={data.status === 'RESOLVED' ? 'ok' : 'brand'}>
              {data.status === 'RESOLVED' ? 'Cleaned with Proof' : 'Under Investigation'}
            </Badge>
          </div>

          <div className={`grid ${data.resolutionPhotoUrl ? 'grid-cols-2 divide-x divide-line' : 'grid-cols-1'}`}>
            {data.photoUrl && (
              <div className="relative">
                <img src={data.photoUrl} alt="Citizen Reported Issue" className="aspect-[4/3] w-full object-cover" />
                <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-sm">
                  1. Citizen Photo
                </span>
              </div>
            )}
            {data.resolutionPhotoUrl && (
              <div className="relative">
                <img src={data.resolutionPhotoUrl} alt="Driver Cleaned Proof" className="aspect-[4/3] w-full object-cover" />
                <span className="absolute bottom-2 left-2 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-sm">
                  2. Driver Cleaned Proof ✅
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Status timeline (plan §2.1) */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-fluid-sm font-semibold">Status</p>
          <Badge tone={STATUS_TONE[data.status]}>{t(`status.${data.status}`)}</Badge>
        </div>

        {rejected ? (
          <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-fluid-sm text-danger">
            This report could not be verified. If you think that's wrong, report it again with a clearer photo.
          </p>
        ) : (
          <ol className="space-y-0">
            {FLOW.map((status, i) => {
              const done = i <= currentIndex;
              const event = data.timeline?.find((t: any) => t.status === status);
              return (
                <li key={status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold transition ${
                        done ? 'bg-brand text-brand-ink' : 'border-2 border-line bg-elevated text-faint'
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    {i < FLOW.length - 1 && <span className={`h-8 w-0.5 ${i < currentIndex ? 'bg-brand' : 'bg-line'}`} />}
                  </div>
                  <div className="pb-2">
                    <p className={`text-fluid-sm font-medium ${done ? '' : 'text-faint'}`}>{t(`status.${status}`)}</p>
                    {event && (
                      <p className="text-fluid-xs text-muted">
                        {event.note} · {timeAgo(event.at)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* Live tracking entry point */}
      {data.trackRoom && !['RESOLVED', 'REJECTED'].includes(data.status) && (
        <Link to={`/app/track/${data.id}`}>
          <Card className="flex items-center gap-3 border-brand/30 bg-brand/5 p-4 transition hover:shadow-lift">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink">
              <Truck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-fluid-sm font-semibold">Track the truck live</p>
              <p className="truncate text-fluid-xs text-muted">{data.vehicle?.registrationNumber} is assigned to this</p>
            </div>
          </Card>
        </Link>
      )}

      {data.alsoReportedBy > 0 && (
        <Card className="flex items-center gap-3 p-4">
          <Users className="h-5 w-5 shrink-0 text-info" />
          <p className="text-fluid-sm">
            <span className="font-semibold">{data.alsoReportedBy} other {data.alsoReportedBy === 1 ? 'person' : 'people'}</span>{' '}
            reported this too — it's been merged into one ticket.
          </p>
        </Card>
      )}

      {/* AI evidence, shown honestly */}
      {data.aiCategory && (
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <p className="text-fluid-sm font-semibold">AI assessment</p>
            {data.aiVerified ? <Badge tone="ok">Verified</Badge> : <Badge tone="warn">Officer reviewed</Badge>}
          </div>
          <p className="text-fluid-sm text-muted">
            Classified as <span className="font-medium text-ink">{t(`category.${data.aiCategory}`)}</span>
          </p>
          <div className="mt-2">
            <Meter value={(data.aiConfidence ?? 0) * 100} tone={data.aiVerified ? 'ok' : 'warn'} label="Confidence" />
          </div>
        </Card>
      )}

      {data.resolutionPhotoUrl && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <Check className="h-4 w-4 text-ok" />
            <p className="text-fluid-sm font-semibold">Proof of resolution</p>
          </div>
          <img src={data.resolutionPhotoUrl} alt="Resolved" className="aspect-[4/3] w-full object-cover" />
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="h-48 w-full">
          <BaseMap center={[data.latitude, data.longitude]} zoom={16} scrollWheelZoom={false}>
            <PinMarker latitude={data.latitude} longitude={data.longitude} tone={data.isEmergency ? 'danger' : 'brand'} />
          </BaseMap>
        </div>
        <div className="flex items-start gap-2 p-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div className="min-w-0 text-fluid-xs">
            <p className="font-medium">{data.address || 'Location pinned on the map'}</p>
            <p className="text-muted">{data.ward?.name} · reported {formatDateTime(data.createdAt)}</p>
          </div>
        </div>
      </Card>

      {data.description && (
        <Card className="p-4">
          <p className="label">What you told us</p>
          <p className="text-fluid-sm">{data.description}</p>
        </Card>
      )}
    </div>
  );
}
