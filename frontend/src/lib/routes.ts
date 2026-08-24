import type { AnalysisLevel, ComparisonKey, DateRangeKey } from '@/contracts';

/**
 * Central route builder. No component hand-builds a workspace URL.
 * Analytic context lives in canonical query parameters so routes stay shareable.
 */

export type AnalyticQuery = {
  scope?: string;
  range?: DateRangeKey;
  compare?: ComparisonKey;
  level?: AnalysisLevel;
  platform?: 'all' | 'google_ads' | 'meta_ads';
  sort?: string;
  dir?: 'asc' | 'desc';
  tab?: string;
};

function qs(query?: AnalyticQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();
  const order: (keyof AnalyticQuery)[] = [
    'scope',
    'range',
    'compare',
    'level',
    'platform',
    'sort',
    'dir',
    'tab',
  ];
  for (const key of order) {
    const value = query[key];
    if (value) params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const routes = {
  home: () => '/',
  signin: (returnTo?: string) =>
    returnTo ? `/signin?returnTo=${encodeURIComponent(returnTo)}` : '/signin',
  onboarding: () => '/onboarding',
  appEntry: () => '/app',
  ops: () => '/ops',

  briefing: (slug: string, q?: AnalyticQuery) => `/w/${slug}${qs(q)}`,
  campaigns: (slug: string, q?: AnalyticQuery) => `/w/${slug}/campaigns${qs(q)}`,
  campaign: (slug: string, id: string, q?: AnalyticQuery) => `/w/${slug}/campaigns/${id}${qs(q)}`,
  intelligence: (slug: string, q?: AnalyticQuery) => `/w/${slug}/intelligence${qs(q)}`,
  run: (slug: string, id: string, q?: AnalyticQuery) => `/w/${slug}/intelligence/${id}${qs(q)}`,
  library: (slug: string, q?: AnalyticQuery) => `/w/${slug}/library${qs(q)}`,
  settings: (slug: string, tab?: string) => `/w/${slug}/settings${tab ? `?tab=${tab}` : ''}`,
  connections: (slug: string) => `/w/${slug}/connections`,
} as const;

/** Preserves the current analytic context when moving between product routes. */
export function withContext(path: string, query?: AnalyticQuery): string {
  const [base] = path.split('?');
  return `${base}${qs(query)}`;
}

export const marketingAnchors = {
  product: '#product',
  decisionLayer: '#decision-layer',
  method: '#method',
  security: '#security',
} as const;
