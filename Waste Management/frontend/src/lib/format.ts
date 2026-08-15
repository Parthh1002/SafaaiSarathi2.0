export const CATEGORY_LABELS: Record<string, string> = {
  GARBAGE_PILE: 'Garbage pile',
  OVERFLOWING_BIN: 'Overflowing bin',
  DEAD_ANIMAL: 'Dead animal',
  CONSTRUCTION_DEBRIS: 'Construction debris',
  MEDICAL_WASTE: 'Medical waste',
  ILLEGAL_DUMPING: 'Illegal dumping',
  SEWAGE_OVERFLOW: 'Sewage overflow',
  BURNING_WASTE: 'Burning waste',
  OTHER: 'Other',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

/** Status colour is identical in every portal so the coding is learnable. */
export const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'ok' | 'danger'> = {
  PENDING: 'neutral',
  VERIFIED: 'info',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warn',
  RESOLVED: 'ok',
  REJECTED: 'danger',
};

export const SEVERITY_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warn',
  CRITICAL: 'danger',
};

export function timeAgo(input?: string | Date | null): string {
  if (!input) return '—';
  const then = new Date(input).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (Number.isNaN(seconds)) return '—';
  if (Math.abs(seconds) < 60) return seconds >= 0 ? 'just now' : 'in a moment';

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
  ];
  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [step, name] of units) {
    if (Math.abs(value) < step) break;
    value = Math.round(value / step);
    unit = name;
  }
  return new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' }).format(-value, unit);
}

export function formatDateTime(input?: string | Date | null): string {
  if (!input) return '—';
  return new Date(input).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(input?: string | Date | null): string {
  if (!input) return '—';
  return new Date(input).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDuration(minutes?: number | null): string {
  if (minutes == null) return '—';
  const abs = Math.abs(minutes);
  if (abs < 60) return `${Math.round(minutes)} min`;
  if (abs < 1440) {
    const h = Math.floor(abs / 60);
    const m = Math.round(abs % 60);
    return `${minutes < 0 ? '-' : ''}${h}h${m ? ` ${m}m` : ''}`;
  }
  return `${(minutes / 1440).toFixed(1)} days`;
}

export const formatDistance = (metres?: number | null) =>
  metres == null ? '—' : metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;

export const formatNumber = (n?: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN').format(Math.round(n));

export const pct = (n?: number | null) => (n == null ? '—' : `${Math.round(n)}%`);

export const initials = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/** Confidence phrasing that never overstates the model. */
export function confidenceLabel(confidence: number, threshold = 0.7) {
  if (confidence >= threshold) return { label: 'AI verified', tone: 'ok' as const };
  if (confidence >= 0.45) return { label: 'Needs review', tone: 'warn' as const };
  return { label: 'Low confidence', tone: 'danger' as const };
}
