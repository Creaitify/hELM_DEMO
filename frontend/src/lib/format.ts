import type { Money } from '@/contracts';

/**
 * One formatting layer. Dates cross contracts as ISO strings and become
 * display values only here. Locale and currency come from the workspace,
 * never hard-coded because the sample workspace happens to use INR.
 */

export const DEFAULT_LOCALE = 'en-IN';

/**
 * Compact values are scaled here rather than by Intl.
 *
 * `notation: 'compact'` reads CLDR, and Node's bundled ICU disagrees with the
 * browser's — 2,268 becomes "2K" on the server and "2T" in Chromium, and
 * ₹3,00,000 becomes "₹3L" against "₹3.0L". Either one breaks hydration, and
 * "2T" is a unit no Indian reader uses. Scaling by hand keeps both runtimes on
 * the same string and keeps the units the ones the workspace counts in.
 */
const INDIAN_SCALE = [
  { at: 1e7, suffix: 'Cr' },
  { at: 1e5, suffix: 'L' },
  { at: 1e3, suffix: 'K' },
] as const;

const WESTERN_SCALE = [
  { at: 1e9, suffix: 'B' },
  { at: 1e6, suffix: 'M' },
  { at: 1e3, suffix: 'K' },
] as const;

type ScaleStep = { at: number; suffix: string };

/** The largest scale step this value reaches, or null if it stays as written. */
function scaleFor(value: number, locale: string): ScaleStep | null {
  const scale = locale.toLowerCase().endsWith('-in') ? INDIAN_SCALE : WESTERN_SCALE;
  const magnitude = Math.abs(value);
  return scale.find((step) => magnitude >= step.at) ?? null;
}

function compactNumber(value: number, locale: string): string {
  const step = scaleFor(value, locale);
  if (!step) return String(Math.round(value));

  const scaled = value / step.at;
  // One decimal below 100, none above, so the column stays narrow.
  const digits = Math.abs(scaled) < 100 ? 1 : 0;
  return `${Number(scaled.toFixed(digits))}${step.suffix}`;
}

const currencyCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, locale: string, digits: number) {
  const key = `${locale}|${currency}|${digits}`;
  const cached = currencyCache.get(key);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
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

  if (!compact) return currencyFormatter(currency, locale, 0).format(value);

  // Scale first, then format the scaled number in standard notation. Going
  // through Intl's own compact notation makes the output depend on whichever
  // CLDR the runtime bundles, and Node's disagrees with the browser's about
  // the trailing zero: ₹3L on the server against ₹3.0L in Chromium.
  const step = scaleFor(value, locale);
  if (!step) return currencyFormatter(currency, locale, 0).format(value);

  const scaled = value / step.at;
  const digits = Math.abs(scaled) < 100 ? 1 : 0;
  // Collapsing the trailing zero in JS keeps both runtimes on the same string.
  const rounded = Number(scaled.toFixed(digits));
  return `${currencyFormatter(currency, locale, digits).format(rounded)}${step.suffix}`;
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
  if (compact) return compactNumber(value, locale);
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
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

/**
 * A span of elapsed time, in the largest unit that still says something.
 *
 * Used for figures like "how long a recommendation waited", where minutes
 * matter under an hour and stop mattering above a day.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return 'Not available';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
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
