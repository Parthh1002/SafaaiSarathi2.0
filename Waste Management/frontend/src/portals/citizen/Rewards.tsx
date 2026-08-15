import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, TrendingDown, Medal } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, SectionTitle } from '../../components/ui';
import { timeAgo } from '../../lib/format';

export default function Rewards() {
  const credits = useQuery({
    queryKey: ['citizen', 'credits'],
    queryFn: async () => (await api('citizen').get('/citizen/credits')).data,
  });
  const board = useQuery({
    queryKey: ['citizen', 'leaderboard'],
    queryFn: async () => (await api('citizen').get('/citizen/leaderboard')).data,
  });

  if (credits.isLoading) return <Loading />;
  if (credits.error) return <ErrorState message="Could not load your credits" onRetry={() => credits.refetch()} />;

  const data = credits.data;

  return (
    <div className="space-y-5">
      <h1 className="text-fluid-xl font-bold tracking-tight">Green credits</h1>

      <Card className="relative overflow-hidden border-brand/30 p-5">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink">
            <Trophy className="h-7 w-7" />
          </span>
          <div>
            <p className="text-fluid-3xl font-bold leading-none tabular-nums text-brand">{data.balance}</p>
            <p className="mt-1 text-fluid-xs text-muted">credits earned for verified reports</p>
          </div>
        </div>

        {board.data && (
          <div className="relative mt-4 flex items-center gap-2 rounded-xl bg-sunken p-3">
            <Medal className="h-4 w-4 shrink-0 text-warn" />
            <p className="text-fluid-sm">
              Ranked <span className="font-bold">#{board.data.rank}</span> of {board.data.total} in{' '}
              {board.data.ward ?? 'your ward'}
            </p>
          </div>
        )}
      </Card>

      <section>
        <SectionTitle title="How credits work" />
        <Card className="divide-y divide-line p-0">
          {[
            { label: 'Submit a report', value: `+${data.rules.reportSubmitted}` },
            { label: 'Report gets verified', value: `+${data.rules.reportVerified}` },
            { label: 'Issue gets resolved', value: `+${data.rules.reportResolved}` },
            { label: 'Emergency report verified', value: `+${data.rules.emergencyVerified}` },
            { label: 'Confirm someone else\'s report', value: `+${data.rules.duplicateReport}` },
            { label: 'Report found to be fake', value: `${data.rules.fakeReport}` },
          ].map((rule) => (
            <div key={rule.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-fluid-sm text-muted">{rule.label}</span>
              <Badge tone={rule.value.startsWith('-') ? 'danger' : 'ok'}>{rule.value}</Badge>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle title="Your ledger" subtitle="Every credit traces back to a real report" />
        {data.entries.length === 0 ? (
          <p className="text-fluid-sm text-muted">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.entries.map((entry: any) => (
              <li key={entry.id}>
                <Card className="flex items-center gap-3 p-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                      entry.delta >= 0 ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'
                    }`}
                  >
                    {entry.delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-fluid-sm font-medium">{entry.reason}</p>
                    <p className="text-fluid-xs text-muted">
                      {entry.complaintCode ? `${entry.complaintCode} · ` : ''}
                      {timeAgo(entry.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-fluid-sm font-bold tabular-nums ${entry.delta >= 0 ? 'text-ok' : 'text-danger'}`}>
                    {entry.delta > 0 ? '+' : ''}
                    {entry.delta}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {board.data?.top?.length > 0 && (
        <section>
          <SectionTitle title="Ward leaderboard" subtitle="Names are partly hidden for privacy" />
          <Card className="divide-y divide-line p-0">
            {board.data.top.map((row: any) => (
              <div
                key={row.position}
                className={`flex items-center gap-3 px-4 py-2.5 ${row.isMe ? 'bg-brand/5' : ''}`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-fluid-xs font-bold ${
                    row.position <= 3 ? 'bg-warn/15 text-warn' : 'bg-sunken text-muted'
                  }`}
                >
                  {row.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-fluid-sm font-medium">
                  {row.name} {row.isMe && <Badge tone="brand" className="ml-1">You</Badge>}
                </span>
                <span className="shrink-0 text-fluid-sm font-bold tabular-nums">{row.greenCredits}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
