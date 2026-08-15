import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Medal,
  Gift,
  CheckCircle2,
  Sparkles,
  Zap,
  Tag,
  Building,
  Bus,
  Droplets,
  TreePine,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, SectionTitle, toast } from '../../components/ui';
import { timeAgo } from '../../lib/format';

interface RewardItem {
  id: string;
  title: string;
  category: 'TAX' | 'TRANSPORT' | 'UTILITY' | 'PLANT';
  pointsRequired: number;
  discount: string;
  description: string;
  partner: string;
  icon: any;
  color: string;
}

const REWARDS_CATALOG: RewardItem[] = [
  {
    id: 'prop-tax-10',
    title: 'Property Tax Rebate Voucher',
    category: 'TAX',
    pointsRequired: 500,
    discount: '10% OFF',
    description: 'Direct discount voucher on Municipal Property Tax assessment for Gandhinagar / GMC.',
    partner: 'Gandhinagar Municipal Corporation (GMC)',
    icon: Building,
    color: '#15803d',
  },
  {
    id: 'brts-bus-pass',
    title: 'GMC BRTS & City Bus 1-Month Pass',
    category: 'TRANSPORT',
    pointsRequired: 300,
    discount: '100% FREE',
    description: 'Unlimited 30-day travel on Gandhinagar & Ahmedabad connecting public transit routes.',
    partner: 'GMC Urban Mobility Board',
    icon: Bus,
    color: '#0284c7',
  },
  {
    id: 'water-bill-20',
    title: 'Municipal Water & Sewerage Concession',
    category: 'UTILITY',
    pointsRequired: 250,
    discount: '₹150 OFF',
    description: 'Instant credit adjustment applied directly to your quarterly water utility bill.',
    partner: 'Gujarat Water Supply & Sewerage Board',
    icon: Droplets,
    color: '#0891b2',
  },
  {
    id: 'plant-sapling',
    title: 'Adopt a City Tree & Free Compost Kit',
    category: 'PLANT',
    pointsRequired: 150,
    discount: 'FREE KIT',
    description: '5 kg certified organic urban compost + 2 native Neem/Tulsi saplings delivered to home.',
    partner: 'Social Forestry Division Gujarat',
    icon: TreePine,
    color: '#16a34a',
  },
];

export default function Rewards() {
  const [redeemed, setRedeemed] = useState<{ [id: string]: string }>({});
  const [claiming, setClaiming] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
  const currentBalance = data.balance;

  const handleClaim = (reward: RewardItem) => {
    if (currentBalance < reward.pointsRequired) {
      toast.warn(`You need ${reward.pointsRequired - currentBalance} more Green Credits to claim this voucher!`);
      return;
    }
    setClaiming(reward.id);
    setTimeout(() => {
      const code = `SS-${reward.category}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-2026`;
      setRedeemed((prev) => ({ ...prev, [reward.id]: code }));
      setClaiming(null);
      toast.success(`🎉 Voucher Claimed! Your code is: ${code}`);
    }, 800);
  };

  const copyVoucher = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success('Voucher code copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-fluid-xl font-bold tracking-tight">Green Credits & Civic Rewards</h1>
          <p className="text-fluid-xs text-muted">Redeem your verified civic contributions for municipal benefits</p>
        </div>
      </div>

      {/* Main Balance Header Card */}
      <Card className="relative overflow-hidden border-brand/30 bg-gradient-to-br from-surface via-surface to-brand/5 p-5 sm:p-6 shadow-md">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink shadow-lg shadow-brand/20">
              <Trophy className="h-8 w-8" />
            </span>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-fluid-3xl font-black leading-none tabular-nums text-brand">{data.balance}</p>
                <span className="text-fluid-sm font-semibold text-muted">Credits</span>
              </div>
              <p className="mt-1 text-fluid-xs text-muted flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                Verified Swachhata Karma Balance
              </p>
            </div>
          </div>

          {board.data && (
            <div className="flex items-center gap-3 rounded-2xl border border-line/60 bg-elevated px-4 py-3 shadow-sm">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-warn/15 text-warn">
                <Medal className="h-5 w-5" />
              </span>
              <div>
                <p className="text-fluid-xs text-muted font-medium">Ward Standing</p>
                <p className="text-fluid-sm font-bold text-ink">
                  Rank <span className="text-warn">#{board.data.rank}</span> of {board.data.total}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ================= CLAIM REWARDS CATALOG ================= */}
      <section>
        <SectionTitle
          title="Redeem & Claim Vouchers"
          subtitle="Use your accumulated credits for official tax rebates, transit passes & utility subsidies"
        />

        <div className="grid gap-3.5 sm:grid-cols-2">
          {REWARDS_CATALOG.map((item) => {
            const isRedeemed = Boolean(redeemed[item.id]);
            const voucherCode = redeemed[item.id];
            const canAfford = currentBalance >= item.pointsRequired;
            const Icon = item.icon;

            return (
              <Card
                key={item.id}
                className={`relative flex flex-col justify-between p-4 transition-all duration-300 ${
                  isRedeemed ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/30' : 'hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: item.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.partner}</span>
                        <h3 className="text-fluid-sm font-bold text-ink leading-tight">{item.title}</h3>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-fluid-xs font-black text-brand">
                      {item.discount}
                    </span>
                  </div>

                  <p className="mt-2.5 text-fluid-xs text-muted leading-relaxed">{item.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-fluid-xs font-semibold">
                    <Zap className="h-3.5 w-3.5 text-brand" />
                    <span className="text-ink font-bold tabular-nums">{item.pointsRequired}</span>
                    <span className="text-muted">credits</span>
                  </div>

                  {isRedeemed ? (
                    <div className="flex items-center gap-1.5">
                      <code className="rounded-lg bg-surface border border-brand/40 px-2 py-1 font-mono text-fluid-xs font-bold text-brand select-all">
                        {voucherCode}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyVoucher(item.id, voucherCode)}
                        className="btn-ghost btn-sm p-1.5 text-brand"
                        title="Copy voucher code"
                      >
                        {copiedId === item.id ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleClaim(item)}
                      disabled={claiming === item.id}
                      className={`btn-sm rounded-xl font-semibold transition ${
                        canAfford
                          ? 'btn-primary shadow-sm hover:shadow'
                          : 'border border-line bg-sunken text-muted opacity-80'
                      }`}
                    >
                      {claiming === item.id ? 'Generating...' : canAfford ? 'Redeem Voucher' : 'Need More Credits'}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ================= HOW CREDITS WORK ================= */}
      <section>
        <SectionTitle title="How credits work" subtitle="Transparent rules for earning and deductions" />
        <Card className="divide-y divide-line p-0 shadow-sm">
          {[
            { label: 'Submit a verified waste report', value: `+${data.rules.reportSubmitted}` },
            { label: 'AI & Officer verification approved', value: `+${data.rules.reportVerified}` },
            { label: 'Issue cleaned up with photo proof', value: `+${data.rules.reportResolved}` },
            { label: 'Emergency report verified (Medical / Bio)', value: `+${data.rules.emergencyVerified}` },
            { label: "Confirm someone else's nearby report", value: `+${data.rules.duplicateReport}` },
            { label: 'Spam / Fake image detected (AI Fraud penalty)', value: `${data.rules.fakeReport}` },
          ].map((rule) => (
            <div key={rule.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-fluid-sm text-muted">{rule.label}</span>
              <Badge tone={rule.value.startsWith('-') ? 'danger' : 'ok'}>{rule.value}</Badge>
            </div>
          ))}
        </Card>
      </section>

      {/* ================= CREDIT LEDGER ================= */}
      <section>
        <SectionTitle title="Your credit ledger" subtitle="Every credit traces back to an authentic civic action" />
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
                  <span
                    className={`shrink-0 text-fluid-sm font-bold tabular-nums ${
                      entry.delta >= 0 ? 'text-ok' : 'text-danger'
                    }`}
                  >
                    {entry.delta > 0 ? '+' : ''}
                    {entry.delta}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ================= WARD LEADERBOARD ================= */}
      {board.data?.top?.length > 0 && (
        <section>
          <SectionTitle title="Ward leaderboard" subtitle="Top clean city contributors in your jurisdiction" />
          <Card className="divide-y divide-line p-0 shadow-sm">
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
                <span className="shrink-0 text-fluid-sm font-bold tabular-nums text-brand">{row.greenCredits} pts</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
