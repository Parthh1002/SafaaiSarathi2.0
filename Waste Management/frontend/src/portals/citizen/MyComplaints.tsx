import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading } from '../../components/ui';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONE, timeAgo } from '../../lib/format';
import { useT } from '../../lib/i18n';



export default function MyComplaints() {
  const t = useT();
  const [filter, setFilter] = useState('all');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['citizen', 'complaints'],
    queryFn: async () => (await api('citizen').get('/citizen/complaints', { params: { limit: 60 } })).data,
  });

  const items = (data ?? []).filter((c: any) => {
    if (filter === 'all') return true;
    if (filter === 'open') return !['RESOLVED', 'REJECTED'].includes(c.status);
    return c.status === filter;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-fluid-xl font-bold tracking-tight">{t('citizen.complaints.title')}</h1>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {[{ id: 'all', label: t('citizen.complaints.filterAll') }, { id: 'open', label: t('citizen.complaints.filterOpen') }, { id: 'RESOLVED', label: t('citizen.complaints.filterResolved') }].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-fluid-xs font-semibold transition ${
              filter === f.id ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-elevated text-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={t('citizen.complaints.loadError')} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t('citizen.complaints.emptyTitle')}
          hint={t('citizen.complaints.emptyHint')}
          action={
            <Link to="/app/report" className="btn-primary btn-sm">
              {t('citizen.home.reportCta')}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((c: any) => (
            <li key={c.id}>
              <Link to={`/app/complaints/${c.id}`}>
                <Card className="flex items-center gap-3 p-3.5 transition hover:shadow-lift">
                  <div className="flex items-center gap-1 shrink-0">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt="Reported" className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="grid h-16 w-16 place-items-center rounded-xl bg-sunken text-faint">
                        <Camera className="h-5 w-5" />
                      </span>
                    )}
                    {c.resolutionPhotoUrl && (
                      <img
                        src={c.resolutionPhotoUrl}
                        alt="Cleaned Proof"
                        className="h-16 w-16 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
                        title="Driver Cleaned Photo Proof"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-fluid-sm font-semibold">{t(`category.${c.category}`)}</p>
                      {c.isEmergency && <Badge tone="danger">SOS</Badge>}
                      {c.upvotes > 0 && <Badge tone="info">{t('citizen.complaints.confirmed', { count: c.upvotes })}</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-fluid-xs text-muted">{c.address || '—'}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                      <span className="font-mono text-fluid-xs text-faint">{c.code}</span>
                      <span className="text-fluid-xs text-faint">{timeAgo(c.createdAt)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
