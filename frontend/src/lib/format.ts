import type { Money } from '@/contracts';

/**
 * One formatting layer. Dates cross contracts as ISO strings and become
 * display values only here. Locale and currency come from the workspace,
 * never hard-coded because the sample workspace happens to use INR.
 */

export const DEFAULT_LOCALE = 'en-IN';

const currencyCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, locale: string, compact: boolean) {
  const key = `${locale}|${currency}|${compact}`;
  const cached = currencyCache.get(key);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  });
  currencyCache.set(key, formatter);
  return formatter;
}

export function formatMoney(
  value: number | null | undefined,
  currency = 'INR',
  options: { locale?: string; compact?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Not available';
  const { locale = DEFAULT_LOCALE, compact = false } = options;
  return currencyFormatter(currency, locale, compact).format(value);
}

export function formatMoneyContract(money: Money, locale = DEFAULT_LOCALE, compact = false): string {
  const major = Number(money.minorUnits) / 100;
  return formatMoney(major, money.currency, { locale, compact });
}

export function formatNumber(
  value: number | null | undefined,
  options: { locale?: string; compact?: boolean; maximumFractionDigits?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Not available';
  const { locale = DEFAULT_LOCALE, compact = false, maximumFractionDigits = 0 } = options;
  return new Intl.NumberFormat(locale, {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits,
  }).format(value);
}

/** Ratios arrive as 0–1 unless the contract says otherwise. */
export function formatPercent(
  ratio: number | null | undefined,
  options: { locale?: string; digits?: number; signed?: boolean } = {},
): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return 'Not available';
  const { locale = DEFAULT_LOCALE, digits = 1, signed = false } = options;
  const formatted = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(ratio);
  return formatted;
}

export function formatMultiple(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Not available';
  return `${value.toFixed(digits)}×`;
}

export function formatDelta(
  ratio: number | null | undefined,
  options: { digits?: number } = {},
): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  const { digits = 1 } = options;
  const pct = ratio * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(digits)}%`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parts(iso: string) {
  const [datePart] = iso.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  return { y, m, d };
}

/** Daily reporting shows dates, never assumed fixed-hour buckets. */
export function formatDate(iso: string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const { y, m, d } = parts(iso);
  if (style === 'short') return `${d} ${SHORT_MONTHS[m - 1]}`;
  if (style === 'long') return `${d} ${MONTHS[m - 1]} ${y}`;
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

export function formatDateRange(startIso: string, endIso: string): string {
  const a = parts(startIso);
  const b = parts(endIso);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${SHORT_MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${SHORT_MONTHS[a.m - 1]} – ${b.d} ${SHORT_MONTHS[b.m - 1]} ${b.y}`;
  return `${formatDate(startIso)} – ${formatDate(endIso)}`;
}

/** Weekday name for a date-only ISO string, computed without timezone drift. */
export function weekdayName(iso: string): string {
  const { y, m, d } = parts(iso);
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function formatHumanDay(iso: string): string {
  const { m, d } = parts(iso);
  return `${weekdayName(iso)}, ${d} ${MONTHS[m - 1]}`;
}

/**
 * Relative label against a fixed reference instant. The mock layer supplies
 * the reference so server and client render identically and never hydrate-mismatch.
 */
export function formatRelative(iso: string | null, nowIso: string): string {
  if (!iso) return 'Never synced';
  const then = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(then) || Number.isNaN(now)) return '—';
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return formatDate(iso.split('T')[0]);
}

export function formatClock(iso: string): string {
  const time = iso.split('T')[1] ?? '';
  return time.slice(0, 5);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
