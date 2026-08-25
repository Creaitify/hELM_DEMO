/**
 * PublicDemoContent — the single typed fixture behind the landing scenes.
 * Everything here is illustrative sample data and is labelled as such on screen.
 */

export type SignalNode = {
  id: string;
  provider: 'google_ads' | 'meta_ads';
  label: string;
  detail: string;
  /** Position on a 0–100 viewBox grid. */
  x: number;
  y: number;
};

export type PublicDemoContent = {
  workspaceLabel: string;
  rangeLabel: string;
  providersLabel: string;
  currencyLabel: string;
  nodes: SignalNode[];
  core: { label: string; detail: string };
  discrepancy: {
    label: string;
    googleReads: string;
    metaReads: string;
    helmReads: string;
    basis: string;
  };
  recommendation: {
    kicker: string;
    headline: string;
    cap: string;
    horizon: string;
    from: string;
    to: string;
    exposure: string;
    exposureNote: string;
    stopConditions: string[];
  };
  evidence: { label: string; value: string; detail: string; tone: 'neutral' | 'warn' | 'bad' | 'good' }[];
};

export const publicDemo: PublicDemoContent = {
  workspaceLabel: 'Sample workspace · Northstar Group',
  rangeLabel: 'Last 30 complete days · 25 Jul – 23 Aug 2026',
  providersLabel: 'Google Ads + Meta Ads',
  currencyLabel: 'INR · Asia/Kolkata',
  nodes: [
    {
      id: 'n1',
      provider: 'google_ads',
      label: 'Northstar India / Search',
      detail: '187-DEM-9021',
      x: 6,
      y: 14,
    },
    {
      id: 'n2',
      provider: 'google_ads',
      label: 'Northstar India / PMax',
      detail: '605-DEM-7740',
      x: 6,
      y: 36,
    },
    {
      id: 'n3',
      provider: 'meta_ads',
      label: 'Northstar India / Prospecting',
      detail: '2385-DEMO-2110',
      x: 6,
      y: 58,
    },
    {
      id: 'n4',
      provider: 'meta_ads',
      label: 'Northstar India / Retargeting',
      detail: '2385-DEMO-2911 · delayed',
      x: 6,
      y: 80,
    },
  ],
  core: {
    label: 'HELM reconciliation',
    detail: '3 of 4 accounts blended · 1 excluded',
  },
  discrepancy: {
    label: 'Platform-reported difference',
    googleReads: 'Google reads 1,356 purchases',
    metaReads: 'Meta reads 1,104 purchases',
    helmReads: 'HELM reads 2,268 on one mapped basis',
    basis: '7-day click · Google primary Purchase + Meta Purchase',
  },
  recommendation: {
    kicker: 'Recommended · proposed, not executed',
    headline: 'Shift up to ₹1,20,000 for 14 days',
    cap: '₹1,20,000 cap',
    horizon: '14 days',
    from: 'Meta · Prospecting / Broad 04',
    to: 'Google · Non-Brand / High Intent',
    exposure: '₹42k – ₹68k',
    exposureNote: 'Modelled acquisition cost if current rates persist. Sample output, not a forecast.',
    stopConditions: [
      'High Intent CPA above ₹1,900 on a 3-day rolling basis',
      'Impression share lost to budget below 4%',
    ],
  },
  evidence: [
    {
      label: 'Meta prospecting CPA',
      value: '+31%',
      detail: 'Against its four-week baseline, after frequency reached 4.8',
      tone: 'bad',
    },
    {
      label: '3-second view rate',
      value: '32% → 24%',
      detail: 'Leading Broad 04 creative · 3-second plays ÷ impressions',
      tone: 'warn',
    },
    {
      label: 'High Intent impression share',
      value: '18% lost',
      detail: 'Eligible impressions missed because daily budget ran out',
      tone: 'warn',
    },
  ],
};

/** Sign-in tells a different story: accounts converging into one selected scope. */
export const signinDemo = {
  workspaceLabel: 'Northstar Group',
  scopeLabel: 'India · Google + Meta',
  accounts: [
    { provider: 'google_ads' as const, label: 'Northstar India / Search', detail: '187-DEM-9021' },
    { provider: 'google_ads' as const, label: 'Northstar India / PMax', detail: '605-DEM-7740' },
    { provider: 'meta_ads' as const, label: 'Northstar India / Prospecting', detail: '2385-DEMO-2110' },
    { provider: 'meta_ads' as const, label: 'Northstar India / Retargeting', detail: '2385-DEMO-2911' },
  ],
  note: 'Illustrative sample workspace',
};

export type AuthViewState = 'ready' | 'redirecting' | 'failed' | 'unavailable';

export type AuthViewScenario = {
  state: AuthViewState;
  message?: string;
};

export const authScenarios: Record<AuthViewState, AuthViewScenario> = {
  ready: { state: 'ready' },
  redirecting: { state: 'redirecting' },
  failed: {
    state: 'failed',
    message: 'Google did not complete the sign-in. Nothing was changed. Try again.',
  },
  unavailable: {
    state: 'unavailable',
    message: 'Sign-in is temporarily unavailable. Try again or contact your workspace administrator.',
  },
};
