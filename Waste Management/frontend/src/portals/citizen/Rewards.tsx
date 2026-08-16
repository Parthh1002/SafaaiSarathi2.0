import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  TrendingUp,
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
  Loader2,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
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
  const queryClient = useQueryClient();
  const [redeemed, setRedeemed] = useState<{ [id: string]: string }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const credits = useQuery({
    queryKey: ['citizen', 'credits'],
    queryFn: async () => (await api('citizen').get('/citizen/credits')).data,
  });
  const board = useQuery({
    queryKey: ['citizen', 'leaderboard'],
    queryFn: async () => (await api('citizen').get('/citizen/leaderboard')).data,
  });

  const redeemMutation = useMutation({
    mutationFn: async (reward: RewardItem) => {
      const res = await api('citizen').post('/citizen/rewards/redeem', {
        rewardId: reward.id,
        pointsRequired: reward.pointsRequired,
        category: reward.category,
        title: reward.title,
      });
      return { ...res.data, rewardId: reward.id };
    },
    onSuccess: async (data) => {
      setRedeemed((prev) => ({ ...prev, [data.rewardId]: data.voucherCode }));
      await queryClient.invalidateQueries({ queryKey: ['citizen', 'credits'] });
      await queryClient.invalidateQueries({ queryKey: ['citizen', 'home'] });
      toast.success(`🎉 Voucher Claimed! Your code is: ${data.voucherCode}`);
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not claim voucher')),
  });

  if (credits.isLoading) return <Loading />;
  if (credits.error) return <ErrorState message="Could not load your credits" onRetry={() => credits.refetch()} />;

  const data = credits.data;
  const currentBalance = data?.balance ?? 0;

  const handleClaim = (reward: RewardItem) => {
    if (currentBalance < reward.pointsRequired) {
      toast.warn(`You need ${reward.pointsRequired - currentBalance} more Green Credits to claim this voucher!`);
      return;
    }
    redeemMutation.mutate(reward);
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
              <p className="text-fluid-xs font-semibold uppercase tracking-wider text-muted">Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-fluid-2xl font-extrabold tracking-tight text-ink tabular-nums">{currentBalance}</span>
                <span className="text-fluid-sm font-semibold text-brand">Green Credits</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:self-center">
            <div className="rounded-xl border border-line bg-surface/80 px-3 py-1.5 backdrop-blur">
              <span className="text-[11px] text-muted">Your Rank: </span>
              <span className="text-fluid-xs font-bold text-ink">#{board.data?.rank ?? '—'}</span>
            </div>
            <div className="rounded-xl border border-line bg-surface/80 px-3 py-1.5 backdrop-blur">
              <span className="text-[11px] text-muted">Total Citizens: </span>
              <span className="text-fluid-xs font-bold text-ink">{board.data?.total ?? '—'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Rewards Catalog */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 className="text-fluid-base font-bold">Municipal Benefits & Vouchers</h2>
          </div>
          <span className="text-fluid-xs text-muted">Official GMC Partners</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {REWARDS_CATALOG.map((reward) => {
            const Icon = reward.icon;
            const canAfford = currentBalance >= reward.pointsRequired;
            const code = redeemed[reward.id];
            const isClaiming = redeemMutation.isPending && redeemMutation.variables?.id === reward.id;

            return (
              <Card
                key={reward.id}
                className={`relative flex flex-col justify-between overflow-hidden border p-4 transition-all duration-200 ${
                  code ? 'border-ok/50 bg-ok/5' : 'hover:border-brand/40 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: reward.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <Badge tone="brand" className="font-bold">
                      {reward.discount}
                    </Badge>
                  </div>

                  <h3 className="mt-3 text-fluid-base font-bold text-ink">{reward.title}</h3>
                  <p className="mt-1 text-fluid-xs text-muted leading-relaxed">{reward.description}</p>
                  <p className="mt-2 text-[11px] font-medium text-faint">Issued by: {reward.partner}</p>
                </div>

                <div className="mt-4 border-t border-line/60 pt-3">
                  {code ? (
                    <div className="flex items-center justify-between rounded-xl border border-ok/30 bg-ok/10 px-3 py-2">
                      <div>
                        <span className="block text-[10px] font-semibold text-ok uppercase tracking-wider">Voucher Code</span>
                        <span className="font-mono text-fluid-xs font-bold text-ink">{code}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyVoucher(reward.id, code)}
                        className="btn-ghost btn-sm flex items-center gap-1 text-ok hover:bg-ok/20"
                      >
                        {copiedId === reward.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        <span>{copiedId === reward.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-fluid-xs font-bold text-ink tabular-nums">
                        {reward.pointsRequired} <span className="text-faint font-normal">pts</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleClaim(reward)}
                        disabled={!canAfford || isClaiming}
                        className={`btn-sm flex items-center gap-1.5 rounded-xl font-semibold transition ${
                          canAfford ? 'btn-primary' : 'border border-line bg-sunken text-faint cursor-not-allowed'
                        }`}
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Claiming…
                          </>
                        ) : canAfford ? (
                          <>
                            <Gift className="h-3.5 w-3.5" /> Claim Voucher
                          </>
                        ) : (
                          `Need ${reward.pointsRequired - currentBalance} more`
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Credit Ledger History */}
      <section className="space-y-3">
        <SectionTitle title="Points Ledger" subtitle="Detailed audit history of all earned & redeemed credits" />
        <Card className="divide-y divide-line p-0">
          {(data?.history ?? []).map((entry: any) => (
            <div key={entry.id} className="flex items-center justify-between p-3.5 text-fluid-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    entry.delta > 0 ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'
                  }`}
                >
                  {entry.delta > 0 ? <Zap className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
                </span>
                <div>
                  <p className="font-medium text-ink leading-snug">{entry.reason}</p>
                  <p className="text-[11px] text-faint">{timeAgo(entry.createdAt)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-mono font-bold ${entry.delta > 0 ? 'text-ok' : 'text-danger'}`}>
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
                <span className="block text-[10px] text-faint">Bal: {entry.balanceAfter}</span>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
