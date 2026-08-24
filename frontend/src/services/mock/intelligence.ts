import type {
  Decision,
  Evidence,
  Finding,
  IntelligenceRun,
  Recommendation,
  RunStageRecord,
} from '@/contracts';
import { COMPARE_END, COMPARE_START, WINDOW_END, WINDOW_START, primaryBasis } from './constants';
import { WINDOW_DATES, frequencySeries, hookRateSeries, impressionShareSeries, decisionStorySeries } from './series';

const metaOnlyBasis = {
  ...primaryBasis,
  accountIds: ['acct_m_prospect'],
  accountBasis: primaryBasis.accountBasis.filter((basis) => basis.accountId === 'acct_m_prospect'),
};

const googleOnlyBasis = {
  ...primaryBasis,
  accountIds: ['acct_g_search'],
  accountBasis: primaryBasis.accountBasis.filter((basis) => basis.accountId === 'acct_g_search'),
};

/* ---------------------------------------------------------------
   Evidence
   --------------------------------------------------------------- */

export const evidence: Evidence[] = [
  {
    id: 'ev_meta_cpa_break',
    title: 'Broad 04 cost per purchase against its four-week baseline',
    kind: 'observed',
    summary:
      'Cost per mapped purchase held near ₹1,869 through late July, then broke upward from 4 August. The window closes at ₹2,449.',
    rows: [
      { label: 'Current window CPA', value: '₹2,449', mono: true, tone: 'bad' },
      { label: 'Four-week baseline CPA', value: '₹1,869', mono: true },
      { label: 'Change', value: '+31.0%', mono: true, tone: 'bad' },
      { label: 'Spend in window', value: '₹7,64,000', mono: true, detail: '+29.1% against the previous 30 days' },
      { label: 'Mapped purchases', value: '312', mono: true, detail: 'Meta Purchase, 7-day click' },
      { label: 'Source account', value: 'Northstar India / Prospecting', detail: '2385-DEMO-2110' },
      { label: 'Break date', value: '4 August 2026', detail: 'Daily budget raised 40% the same day' },
    ],
    series: {
      metric: 'cpa',
      points: decisionStorySeries[0].points,
      annotations: [{ date: '2026-08-04', label: 'Daily budget raised 40%', tone: 'warn' }],
    },
    basis: metaOnlyBasis,
    method: 'Directly reported by Meta Ads. No modelling applied.',
  },
  {
    id: 'ev_frequency_climb',
    title: 'Average impressions per person reached, Broad 04',
    kind: 'observed',
    summary:
      'Frequency climbed steadily from 3.2 to 4.8 across the window and crossed 4.0 on 11 August, three days before the sharpest CPA movement.',
    rows: [
      { label: 'Frequency at window close', value: '4.8', mono: true, tone: 'bad' },
      { label: 'Frequency at window open', value: '3.2', mono: true },
      { label: 'Crossed 4.0 on', value: '11 August 2026', mono: true, tone: 'warn' },
      { label: 'Reach in window', value: '1,275,000', mono: true },
      { label: 'Impressions in window', value: '6,120,000', mono: true },
      { label: 'Definition', value: 'Impressions ÷ people reached', detail: 'Meta reported. Google Search has no comparable figure.' },
    ],
    series: { metric: 'frequency', points: frequencySeries },
    basis: metaOnlyBasis,
    method: 'Directly reported by Meta Ads.',
  },
  {
    id: 'ev_hook_decay',
    title: '3-second video-view rate on the leading Broad 04 creative',
    kind: 'calculated',
    summary:
      'The typographic “18 Hours” cut carried most of the delivery. Its 3-second view rate fell from 32% to 24% while frequency on that asset reached 5.2.',
    rows: [
      { label: 'Rate at window open', value: '32.0%', mono: true },
      { label: 'Rate at window close', value: '24.0%', mono: true, tone: 'bad' },
      { label: 'Formula', value: '3-second video plays ÷ impressions', detail: 'Derived. Not a universal hook score.' },
      { label: 'Creative frequency', value: '5.2', mono: true, tone: 'bad' },
      { label: 'Share of ad set spend', value: '54%', mono: true },
      { label: 'First delivered', value: '12 June 2026', mono: true },
      { label: 'Hold rate', value: '31%', mono: true, detail: '15-second plays ÷ 3-second plays' },
    ],
    series: { metric: 'hook_rate', points: hookRateSeries },
    basis: metaOnlyBasis,
    method:
      'Calculated from Meta video play and impression counts. Carousel assets in the same ad set report no video metrics and are excluded.',
  },
  {
    id: 'ev_google_is_lost',
    title: 'High Intent impression share lost to budget',
    kind: 'observed',
    summary:
      'Google reports 18% of eligible impressions missed because the daily budget ran out, concentrated in the 18:00–22:00 window that converts best.',
    rows: [
      { label: 'Impression share lost to budget', value: '18.0%', mono: true, tone: 'warn' },
      { label: 'Search impression share', value: '61.4%', mono: true },
      { label: 'Lost to rank', value: '20.6%', mono: true },
      { label: 'Current CPA', value: '₹1,733', mono: true, tone: 'good' },
      { label: 'CPA change', value: '+1.2%', mono: true, detail: 'Within normal variation' },
      { label: 'Peak shortfall hours', value: '18:00–22:00 IST', mono: true },
      { label: 'Source account', value: 'Northstar India / Search', detail: '187-DEM-9021' },
    ],
    series: { metric: 'impression_share', points: impressionShareSeries },
    basis: googleOnlyBasis,
    method: 'Directly reported by Google Ads at campaign level.',
  },
  {
    id: 'ev_exposure_model',
    title: 'Modelled acquisition-cost exposure',
    kind: 'inferred',
    summary:
      'Holding mapped volume at 55 purchases and comparing the observed Meta CPA band with Google’s capacity-adjusted band gives a ₹42k–₹68k range. This is modelled sample output, not a forecast.',
    rows: [
      { label: 'Mapped volume held at', value: '55 purchases', mono: true },
      { label: 'Observed Meta CPA band', value: '₹2,300 – ₹2,600', mono: true },
      { label: 'Google capacity-adjusted CPA band', value: '₹1,360 – ₹1,540', mono: true },
      { label: 'Formula', value: '55 × (Meta CPA band − Google CPA band)', detail: 'Disclosed calculation' },
      { label: 'Result', value: '₹41,800 – ₹68,200', mono: true, detail: 'Displayed rounded as ₹42k–₹68k' },
      { label: 'Excluded from the model', value: 'View-through lift, saturation past the cap, any revenue effect' },
      { label: 'Label', value: 'Modelled sample output', tone: 'warn', detail: 'Not a forecast and not a guarantee' },
    ],
    basis: primaryBasis,
    method:
      'Inferred. The band is a comparison of two observed CPA ranges at fixed volume. It deliberately carries no revenue or incrementality assumption.',
  },
  {
    id: 'ev_mapping_basis',
    title: 'Conversion mapping and comparison basis',
    kind: 'observed',
    summary:
      'Only Google primary Purchase and Meta Purchase are mapped, both normalized to a click-attributed purchase on a common illustrative 7-day click basis.',
    rows: [
      { label: 'Google event', value: 'Purchase (primary)', detail: 'Conversion action “Purchase — web”' },
      { label: 'Meta event', value: 'Purchase', detail: 'Pixel-reported, 7-day click' },
      { label: 'Common basis', value: '7-day click', mono: true },
      { label: 'Analysis window', value: '25 Jul – 23 Aug 2026', mono: true, detail: '30 complete Asia/Kolkata days' },
      { label: 'Comparison window', value: '25 Jun – 24 Jul 2026', mono: true },
      { label: 'Excluded', value: 'Northstar US / Search', detail: 'USD and an America/New_York reporting day' },
      { label: 'Excluded', value: 'Northstar India / Retargeting', tone: 'warn', detail: 'Sync 19 hours behind' },
      { label: 'Excluded', value: '24 August', detail: 'Current partial day' },
    ],
    basis: primaryBasis,
    method:
      'Provider-reported values remain inspectable per account. Google conversion value and Meta purchase value are never summed into a single blended revenue figure.',
  },
  {
    id: 'ev_advantage_recovery',
    title: 'Advantage+ Shopping after the 29 July creative refresh',
    kind: 'observed',
    summary:
      'The field-use cut entered delivery on 29 July. Advantage+ CPA improved 6.4% while frequency stayed at 2.6.',
    rows: [
      { label: 'CPA', value: '₹1,837', mono: true, tone: 'good' },
      { label: 'CPA change', value: '−6.4%', mono: true, tone: 'good' },
      { label: 'Frequency', value: '2.6', mono: true, tone: 'good' },
      { label: 'New creative first delivered', value: '29 July 2026', mono: true },
      { label: '3-second view rate', value: '34.0%', mono: true, tone: 'good' },
    ],
    basis: metaOnlyBasis,
    method: 'Directly reported by Meta Ads.',
  },
  {
    id: 'ev_retarget_delay',
    title: 'Retargeting reporting delay',
    kind: 'observed',
    summary:
      'Meta reporting for the Retargeting account last completed at 14:20 on 23 August. Its campaigns stay visible but are excluded from blended totals.',
    rows: [
      { label: 'Last successful sync', value: '23 Aug 2026, 14:20 IST', mono: true, tone: 'warn' },
      { label: 'Delay', value: '19 hours', mono: true, tone: 'warn' },
      { label: 'Next scheduled attempt', value: '24 Aug 2026, 12:58 IST', mono: true },
      { label: 'Affected campaigns', value: '2', mono: true },
      { label: 'Effect on totals', value: 'Excluded', detail: 'Spend, value, ROAS, CPA and purchases all exclude this account.' },
    ],
    basis: { ...primaryBasis, accountIds: ['acct_m_retarget'], accountBasis: [] },
    method: 'Connection health reported by the sync scheduler.',
  },
];

export const evidenceById = (id: string): Evidence | undefined =>
  evidence.find((item) => item.id === id);

/* ---------------------------------------------------------------
   Findings
   --------------------------------------------------------------- */

export const findings: Finding[] = [
  {
    id: 'fnd_meta_cpa',
    title: 'Meta prospecting CPA rose 31% after frequency crossed 4.6',
    observation:
      'Prospecting / Broad 04 raised daily budget 40% on 4 August. Spend rose 29% while mapped purchases grew 4%, so cost per purchase moved from a ₹1,869 baseline to ₹2,449.',
    kind: 'observed',
    severity: 'decision',
    exposure: {
      low: { currency: 'INR', minorUnits: '4200000' },
      high: { currency: 'INR', minorUnits: '6800000' },
      note: 'Modelled acquisition cost over the next 14 days if current rates persist.',
    },
    confidence: 'high',
    confidenceNote: '30 complete days, single account, directly reported by Meta. No modelling in the observation itself.',
    evidenceIds: ['ev_meta_cpa_break', 'ev_frequency_climb', 'ev_exposure_model', 'ev_mapping_basis'],
    basis: metaOnlyBasis,
    recommendedNextStep: 'Cap Broad 04 and run a bounded 14-day shift into Google High Intent.',
    affectedCampaignIds: ['cmp_m_broad_04'],
    sourceAccountIds: ['acct_m_prospect'],
    metricHighlights: [
      { key: 'cpa', value: 2449, currency: 'INR', previousValue: 1869, deltaRatio: 0.31 },
      { key: 'frequency', value: 4.8, previousValue: 3.2, deltaRatio: 0.5 },
      { key: 'spend', value: 764000, currency: 'INR', previousValue: 591600, deltaRatio: 0.291 },
    ],
  },
  {
    id: 'fnd_google_capacity',
    title: 'Google High Intent is efficient and limited by budget',
    observation:
      'Non-Brand / High Intent holds a ₹1,733 CPA within normal variation while losing 18% of eligible impressions to budget, concentrated in the 18:00–22:00 window that converts best.',
    kind: 'observed',
    severity: 'decision',
    exposure: {
      low: { currency: 'INR', minorUnits: '2800000' },
      high: { currency: 'INR', minorUnits: '4400000' },
      note: 'Modelled value of the purchases the budget ceiling is currently declining.',
    },
    confidence: 'high',
    confidenceNote: 'Impression share is reported directly by Google at campaign level across all 30 days.',
    evidenceIds: ['ev_google_is_lost', 'ev_exposure_model', 'ev_mapping_basis'],
    basis: googleOnlyBasis,
    recommendedNextStep: 'Receive the capped test budget and hold target CPA unchanged.',
    affectedCampaignIds: ['cmp_g_high_intent'],
    sourceAccountIds: ['acct_g_search'],
    metricHighlights: [
      { key: 'impression_share', value: 0.18, previousValue: 0.06, deltaRatio: 2.0 },
      { key: 'cpa', value: 1733, currency: 'INR', previousValue: 1712, deltaRatio: 0.012 },
      { key: 'roas', value: 4.36, previousValue: 4.31, deltaRatio: 0.012 },
    ],
  },
  {
    id: 'fnd_creative_fatigue',
    title: 'The leading prospecting creative is repeating itself',
    observation:
      'The typographic “18 Hours” cut carries 54% of Broad 04 delivery. Its 3-second view rate fell from 32% to 24% and its own frequency reached 5.2.',
    kind: 'calculated',
    severity: 'decision',
    exposure: {
      low: { currency: 'INR', minorUnits: '1800000' },
      high: { currency: 'INR', minorUnits: '3100000' },
      note: 'Modelled cost of continued delivery at the current view rate for 14 days.',
    },
    confidence: 'medium',
    confidenceNote:
      'View rate is calculated from reported plays and impressions. Carousel assets in the same ad set report no video metrics, so 12% of spend is not covered.',
    evidenceIds: ['ev_hook_decay', 'ev_frequency_climb', 'ev_advantage_recovery'],
    basis: metaOnlyBasis,
    recommendedNextStep: 'Promote the field-use cut and brief two replacements from the Arc Bottle direction.',
    affectedCampaignIds: ['cmp_m_broad_04', 'cmp_m_interest_stack'],
    sourceAccountIds: ['acct_m_prospect'],
    metricHighlights: [
      { key: 'hook_rate', value: 0.24, previousValue: 0.32, deltaRatio: -0.25 },
      { key: 'hold_rate', value: 0.31, previousValue: 0.39, deltaRatio: -0.205 },
      { key: 'frequency', value: 5.2, previousValue: 3.4, deltaRatio: 0.529 },
    ],
  },
  {
    id: 'fnd_interest_stack',
    title: 'Interest Stack 02 is following the same creative curve',
    observation:
      'Frequency reached 3.1 and CPA rose 9.2%. It runs the same Arc Bottle asset family as Broad 04, so the fatigue signal is likely shared rather than independent.',
    kind: 'inferred',
    severity: 'watch',
    confidence: 'medium',
    confidenceNote: 'Two campaigns sharing an asset family. Directional, not yet decisive.',
    evidenceIds: ['ev_hook_decay', 'ev_frequency_climb'],
    basis: metaOnlyBasis,
    recommendedNextStep: 'Re-check after the Broad 04 creative refresh lands.',
    affectedCampaignIds: ['cmp_m_interest_stack'],
    sourceAccountIds: ['acct_m_prospect'],
    metricHighlights: [
      { key: 'cpa', value: 2149, currency: 'INR', previousValue: 1968, deltaRatio: 0.092 },
      { key: 'frequency', value: 3.1, previousValue: 2.5, deltaRatio: 0.24 },
    ],
  },
  {
    id: 'fnd_category_drift',
    title: 'Category Terms is drifting above its target CPA',
    observation:
      'CPA rose 3.8% to ₹2,357 against a ₹2,200 target while spend fell 2.1%. The drift is slow and inside one account.',
    kind: 'observed',
    severity: 'watch',
    confidence: 'high',
    confidenceNote: 'Reported directly by Google across all 30 days.',
    evidenceIds: ['ev_mapping_basis'],
    basis: googleOnlyBasis,
    recommendedNextStep: 'Review the query report before changing the target.',
    affectedCampaignIds: ['cmp_g_category'],
    sourceAccountIds: ['acct_g_search'],
    metricHighlights: [{ key: 'cpa', value: 2357, currency: 'INR', previousValue: 2271, deltaRatio: 0.038 }],
  },
  {
    id: 'fnd_pmax_learning',
    title: 'PMax New Customer Push is still incomplete',
    observation:
      'Nine days of delivery inside a 30-day window. Its ₹2,448 CPA is treated as incomplete rather than compared.',
    kind: 'observed',
    severity: 'watch',
    confidence: 'low',
    confidenceNote: 'Nine of 30 days. Not enough delivery to compare against the previous period.',
    evidenceIds: ['ev_mapping_basis'],
    basis: { ...primaryBasis, accountIds: ['acct_g_pmax'] },
    recommendedNextStep: 'Leave untouched until 21 complete days exist.',
    affectedCampaignIds: ['cmp_g_pmax_newcust'],
    sourceAccountIds: ['acct_g_pmax'],
    metricHighlights: [
      { key: 'spend', value: 235000, currency: 'INR', previousValue: 166400, deltaRatio: 0.412 },
      { key: 'cpa', value: 2448, currency: 'INR', previousValue: null, deltaRatio: null, availability: 'partial', caveat: 'Comparison period has too little delivery.' },
    ],
  },
  {
    id: 'fnd_retarget_gap',
    title: 'Retargeting reporting is 19 hours behind',
    observation:
      'Two campaigns worth ₹2,94,000 of spend are visible but excluded from every blended figure until the sync recovers.',
    kind: 'observed',
    severity: 'watch',
    confidence: 'high',
    confidenceNote: 'Reported by the sync scheduler.',
    evidenceIds: ['ev_retarget_delay'],
    basis: { ...primaryBasis, accountIds: ['acct_m_retarget'], accountBasis: [] },
    recommendedNextStep: 'No action. The next scheduled attempt is at 12:58 IST.',
    affectedCampaignIds: ['cmp_m_retarget_dpa', 'cmp_m_retarget_engage'],
    sourceAccountIds: ['acct_m_retarget'],
    metricHighlights: [],
  },
  {
    id: 'fnd_advantage_recovery',
    title: 'Advantage+ Shopping improved after the 29 July refresh',
    observation: 'CPA fell 6.4% to ₹1,837 and frequency held at 2.6. The field-use cut is carrying it.',
    kind: 'observed',
    severity: 'stable',
    confidence: 'high',
    confidenceNote: 'Reported directly by Meta across 26 days of delivery.',
    evidenceIds: ['ev_advantage_recovery'],
    basis: metaOnlyBasis,
    affectedCampaignIds: ['cmp_m_advantage'],
    sourceAccountIds: ['acct_m_prospect'],
    metricHighlights: [{ key: 'cpa', value: 1837, currency: 'INR', previousValue: 1963, deltaRatio: -0.064 }],
  },
  {
    id: 'fnd_brand_steady',
    title: 'Brand / Core is steady',
    observation: 'ROAS 14.45× on ₹2,18,000 of spend, unchanged within noise. Excluded from incremental comparisons.',
    kind: 'observed',
    severity: 'stable',
    confidence: 'high',
    confidenceNote: 'Reported directly by Google.',
    evidenceIds: ['ev_mapping_basis'],
    basis: googleOnlyBasis,
    affectedCampaignIds: ['cmp_g_brand'],
    sourceAccountIds: ['acct_g_search'],
    metricHighlights: [{ key: 'roas', value: 14.45, previousValue: 14.51, deltaRatio: -0.004 }],
  },
  {
    id: 'fnd_pmax_core_steady',
    title: 'PMax Arc Bottle Core is holding its baseline',
    observation: 'CPA improved 1.8% on 6.2% more spend. Nothing here needs attention this week.',
    kind: 'observed',
    severity: 'stable',
    confidence: 'high',
    confidenceNote: 'Reported directly by Google across all 30 days.',
    evidenceIds: ['ev_mapping_basis'],
    basis: { ...primaryBasis, accountIds: ['acct_g_pmax'] },
    affectedCampaignIds: ['cmp_g_pmax_core'],
    sourceAccountIds: ['acct_g_pmax'],
    metricHighlights: [{ key: 'cpa', value: 1640, currency: 'INR', previousValue: 1670, deltaRatio: -0.018 }],
  },
];

export const findingById = (id: string): Finding | undefined => findings.find((f) => f.id === id);

export const decisionFindings = findings.filter((f) => f.severity === 'decision');
export const watchFindings = findings.filter((f) => f.severity === 'watch');
export const stableFindings = findings.filter((f) => f.severity === 'stable');

/* ---------------------------------------------------------------
   Recommendations
   --------------------------------------------------------------- */

export const recommendations: Recommendation[] = [
  {
    id: 'rec_budget_test',
    findingId: 'fnd_meta_cpa',
    action:
      'Run a 14-day test shifting up to ₹1,20,000 from Meta Prospecting / Broad 04 into Google Non-Brand / High Intent.',
    rationale:
      'Broad 04 is paying more for the same audience while High Intent is declining eligible demand at a lower cost per purchase. Moving a bounded amount tests whether the capacity is real before anything permanent changes.',
    assumptions: [
      'Mapped purchase volume stays near 55 per week at the tested spend level.',
      'High Intent holds its target CPA as budget rises; the capacity-adjusted band allows for some decay.',
      'Meta delivery does not reallocate the removed budget into an equally fatigued ad set.',
    ],
    risks: [
      'Google CPA can rise as it buys further down the auction. The band already assumes some of this.',
      'Reducing Meta spend can shrink upper-funnel reach in ways a 14-day click-attributed window will not show.',
      'View-through effects are excluded from the model entirely.',
    ],
    affectedAccountIds: ['acct_m_prospect', 'acct_g_search'],
    affectedCampaignIds: ['cmp_m_broad_04', 'cmp_g_high_intent'],
    expectedDirection: 'decrease',
    expectedRange: '₹42,000 – ₹68,000 lower acquisition cost over 14 days',
    cap: { currency: 'INR', minorUnits: '12000000' },
    horizon: '14 days · 25 Aug – 7 Sep',
    stopConditions: [
      'High Intent CPA exceeds ₹1,900 on a 3-day rolling basis.',
      'High Intent impression share lost to budget falls below 4% before the cap is reached.',
      'Blended purchases fall more than 8% against the trailing two weeks.',
    ],
    effort: 'low',
    urgency: 'today',
    status: 'proposed',
  },
  {
    id: 'rec_creative_refresh',
    findingId: 'fnd_creative_fatigue',
    action:
      'Promote the field-use cut to primary in Broad 04 and brief two replacements from the Arc Bottle direction.',
    rationale:
      'The field-use variant holds a 34% 3-second view rate at frequency 2.4 while the typographic cut has decayed to 24% at frequency 5.2. Rotating delivery costs nothing and buys time for new assets.',
    assumptions: [
      'The field-use cut scales past its current 1.4M impressions without immediate decay.',
      'Two replacements can be produced inside seven days.',
    ],
    risks: [
      'A single strong variant can fatigue faster once it carries full delivery.',
      'Carousel assets in the same ad set report no video metrics, so 12% of spend stays unmeasured on this axis.',
    ],
    affectedAccountIds: ['acct_m_prospect'],
    affectedCampaignIds: ['cmp_m_broad_04'],
    expectedDirection: 'protect',
    expectedRange: 'Directional. No cost range is modelled for a rotation.',
    horizon: '7 days',
    stopConditions: ['Field-use 3-second view rate falls below 28%.'],
    effort: 'medium',
    urgency: 'this_week',
    status: 'proposed',
  },
  {
    id: 'rec_frequency_cap',
    findingId: 'fnd_interest_stack',
    action: 'Investigate whether Interest Stack 02 and Broad 04 are competing for the same people.',
    rationale:
      'Both run the same asset family and both show rising frequency. Audience overlap would explain the shared curve and change what the right fix is.',
    assumptions: ['Overlap reporting is available for both ad sets.'],
    risks: ['Overlap analysis is directional and can mislead at small reach.'],
    affectedAccountIds: ['acct_m_prospect'],
    affectedCampaignIds: ['cmp_m_interest_stack', 'cmp_m_broad_04'],
    expectedDirection: 'investigate',
    expectedRange: 'Not modelled.',
    horizon: 'This week',
    stopConditions: [],
    effort: 'low',
    urgency: 'this_week',
    status: 'proposed',
  },
];

export const recommendationById = (id: string): Recommendation | undefined =>
  recommendations.find((rec) => rec.id === id);

export const recommendationsForFinding = (findingId: string): Recommendation[] =>
  recommendations.filter((rec) => rec.findingId === findingId);

/* ---------------------------------------------------------------
   Intelligence runs
   --------------------------------------------------------------- */

function stages(active: number, records: [string, string][], failedAt?: number): RunStageRecord[] {
  const keys = [
    'queued',
    'collecting_evidence',
    'analyzing',
    'reviewing',
    'waiting_for_decision',
    'building_artifact',
    'complete',
  ] as const;
  return records.map(([detail, at], index) => ({
    stage: keys[index],
    label: [
      'Queued',
      'Collecting evidence',
      'Analyzing',
      'Reviewing',
      'Waiting for your decision',
      'Building artifact',
      'Complete',
    ][index],
    state:
      failedAt === index
        ? 'failed'
        : index < active
          ? 'done'
          : index === active
            ? 'active'
            : 'pending',
    detail,
    at: at || undefined,
  }));
}

export const runs: IntelligenceRun[] = [
  {
    id: 'run_0824_cpa',
    title: 'Why did blended cost per purchase rise last week?',
    intent: 'Diagnose a performance change',
    stage: 'waiting_for_decision',
    stages: stages(4, [
      ['Requested from Briefing', '2026-08-24T07:41:00+05:30'],
      ['4 accounts · 30 complete days · 11 campaigns', '2026-08-24T07:41:22+05:30'],
      ['3 findings, 6 evidence records', '2026-08-24T07:43:05+05:30'],
      ['Basis, exclusions and confidence checked', '2026-08-24T07:44:11+05:30'],
      ['1 recommendation is waiting for a decision', '2026-08-24T07:44:30+05:30'],
      ['', ''],
      ['', ''],
    ]),
    startedAt: '2026-08-24T07:41:00+05:30',
    requestedBy: 'Aniket Rao',
    scopeLabel: 'India · Google + Meta',
    rangeLabel: '25 Jul – 23 Aug 2026 vs previous 30 days',
    findingIds: ['fnd_meta_cpa', 'fnd_google_capacity', 'fnd_creative_fatigue'],
    recommendationIds: ['rec_budget_test', 'rec_creative_refresh'],
    summary:
      'Blended cost per purchase rose 7.1% because Meta Prospecting / Broad 04 raised budget 40% into a fatiguing creative while Google High Intent, the more efficient buyer, was capped.',
    artifactId: 'art_memo_0824',
  },
  {
    id: 'run_0824_creative',
    title: 'Creative fatigue across the Arc Bottle family',
    intent: 'Investigate creative fatigue',
    stage: 'analyzing',
    stages: stages(2, [
      ['Requested from Campaigns', '2026-08-24T09:02:00+05:30'],
      ['5 creatives · 3 campaigns · 30 complete days', '2026-08-24T09:02:18+05:30'],
      ['Comparing view-rate decay against frequency', '2026-08-24T09:04:40+05:30'],
      ['', ''],
      ['', ''],
      ['', ''],
      ['', ''],
    ]),
    startedAt: '2026-08-24T09:02:00+05:30',
    requestedBy: 'Aniket Rao',
    scopeLabel: 'Meta Ads only',
    rangeLabel: '25 Jul – 23 Aug 2026',
    findingIds: ['fnd_creative_fatigue', 'fnd_interest_stack'],
    recommendationIds: ['rec_creative_refresh'],
    summary: 'Running now. Two findings have already been drafted.',
  },
  {
    id: 'run_0821_weekly',
    title: 'Weekly review — week ending 21 August',
    intent: 'Prepare the weekly review',
    stage: 'complete',
    stages: stages(7, [
      ['Scheduled', '2026-08-21T07:00:00+05:30'],
      ['4 accounts · 7 complete days', '2026-08-21T07:00:31+05:30'],
      ['5 findings, 9 evidence records', '2026-08-21T07:02:44+05:30'],
      ['Basis and exclusions checked', '2026-08-21T07:03:29+05:30'],
      ['2 recommendations reviewed', '2026-08-21T07:03:50+05:30'],
      ['Decision memo composed', '2026-08-21T07:04:12+05:30'],
      ['Delivered to Library', '2026-08-21T07:04:20+05:30'],
    ]),
    startedAt: '2026-08-21T07:00:00+05:30',
    completedAt: '2026-08-21T07:04:20+05:30',
    requestedBy: 'Scheduled · Monday 07:00 IST',
    scopeLabel: 'India · Google + Meta',
    rangeLabel: '15 – 21 Aug 2026',
    findingIds: ['fnd_google_capacity', 'fnd_category_drift', 'fnd_advantage_recovery'],
    recommendationIds: ['rec_frequency_cap'],
    summary:
      'Efficiency held except on Meta prospecting, where frequency crossed 4.0 mid-week. Google High Intent began missing evening demand.',
    artifactId: 'art_memo_0821',
  },
  {
    id: 'run_0818_budget',
    title: 'Where can ₹2L move without hurting volume?',
    intent: 'Find budget reallocation opportunities',
    stage: 'complete',
    stages: stages(7, [
      ['Requested from Intelligence', '2026-08-18T11:20:00+05:30'],
      ['4 accounts · 30 complete days', '2026-08-18T11:20:26+05:30'],
      ['4 findings, 7 evidence records', '2026-08-18T11:22:51+05:30'],
      ['Compatibility and exclusions checked', '2026-08-18T11:23:40+05:30'],
      ['3 recommendations reviewed', '2026-08-18T11:24:02+05:30'],
      ['Decision memo composed', '2026-08-18T11:24:31+05:30'],
      ['Delivered to Library', '2026-08-18T11:24:38+05:30'],
    ]),
    startedAt: '2026-08-18T11:20:00+05:30',
    completedAt: '2026-08-18T11:24:38+05:30',
    requestedBy: 'Priya Menon',
    scopeLabel: 'India · Google + Meta',
    rangeLabel: '20 Jul – 18 Aug 2026',
    findingIds: ['fnd_google_capacity', 'fnd_category_drift'],
    recommendationIds: ['rec_budget_test'],
    summary:
      'Two candidates: Non-Brand / Competitor at ₹3,263 CPA, and evening capacity on High Intent. Competitor was dismissed as too small to matter.',
    artifactId: 'art_memo_0818',
  },
  {
    id: 'run_0812_diagnose',
    title: 'Did the 29 July creative refresh work?',
    intent: 'Diagnose a performance change',
    stage: 'complete',
    stages: stages(7, [
      ['Requested from Campaigns', '2026-08-12T16:05:00+05:30'],
      ['1 account · 14 complete days', '2026-08-12T16:05:19+05:30'],
      ['2 findings, 4 evidence records', '2026-08-12T16:06:52+05:30'],
      ['Basis checked', '2026-08-12T16:07:20+05:30'],
      ['1 recommendation reviewed', '2026-08-12T16:07:33+05:30'],
      ['Decision memo composed', '2026-08-12T16:07:58+05:30'],
      ['Delivered to Library', '2026-08-12T16:08:04+05:30'],
    ]),
    startedAt: '2026-08-12T16:05:00+05:30',
    completedAt: '2026-08-12T16:08:04+05:30',
    requestedBy: 'Aniket Rao',
    scopeLabel: 'Meta Ads only',
    rangeLabel: '29 Jul – 11 Aug 2026',
    findingIds: ['fnd_advantage_recovery'],
    recommendationIds: [],
    summary: 'Yes on Advantage+, where CPA fell 6.4%. No measurable effect on Broad 04, which kept the older cut.',
    artifactId: 'art_memo_0812',
  },
  {
    id: 'run_0809_blocked',
    title: 'Compare India and US search efficiency',
    intent: 'Ask a custom question',
    stage: 'blocked',
    stages: [
      { stage: 'queued', label: 'Queued', state: 'done', detail: 'Requested from Intelligence', at: '2026-08-09T10:12:00+05:30' },
      {
        stage: 'collecting_evidence',
        label: 'Collecting evidence',
        state: 'failed',
        detail: 'Northstar US reports in USD on an America/New_York day. No named conversion basis exists for this workspace.',
        at: '2026-08-09T10:12:24+05:30',
      },
      { stage: 'analyzing', label: 'Analyzing', state: 'skipped' },
      { stage: 'reviewing', label: 'Reviewing', state: 'skipped' },
      { stage: 'waiting_for_decision', label: 'Waiting for your decision', state: 'skipped' },
      { stage: 'building_artifact', label: 'Building artifact', state: 'skipped' },
      { stage: 'complete', label: 'Complete', state: 'skipped' },
    ],
    startedAt: '2026-08-09T10:12:00+05:30',
    requestedBy: 'Aniket Rao',
    scopeLabel: 'Global rollup',
    rangeLabel: '11 Jul – 9 Aug 2026',
    findingIds: [],
    recommendationIds: [],
    summary:
      'Blocked rather than blended. A side-by-side comparison is available; a single combined figure is not, because no exchange-rate basis is configured.',
  },
];

export const runById = (id: string): IntelligenceRun | undefined => runs.find((run) => run.id === id);

export const activeRun = runs.find((run) => run.stage === 'analyzing');

export const decisions: Decision[] = [
  {
    id: 'dec_0821_freq',
    runId: 'run_0821_weekly',
    recommendationId: 'rec_frequency_cap',
    outcome: 'saved',
    by: 'Aniket Rao',
    at: '2026-08-21T09:14:00+05:30',
    note: 'Revisit once the creative refresh lands.',
  },
  {
    id: 'dec_0818_competitor',
    runId: 'run_0818_budget',
    recommendationId: 'rec_budget_test',
    outcome: 'revision_requested',
    by: 'Priya Menon',
    at: '2026-08-18T15:02:00+05:30',
    note: 'Cap it and put stop conditions on High Intent CPA before I approve anything.',
  },
  {
    id: 'dec_0812_refresh',
    runId: 'run_0812_diagnose',
    recommendationId: 'rec_creative_refresh',
    outcome: 'approved',
    by: 'Aniket Rao',
    at: '2026-08-12T16:31:00+05:30',
    note: 'Approved for Advantage+ only.',
  },
];

export const INTENTS = [
  {
    id: 'diagnose',
    label: 'Diagnose a performance change',
    detail: 'Start from a movement and work back to its cause.',
  },
  { id: 'weekly', label: 'Prepare the weekly review', detail: 'One memo covering what changed and what to do.' },
  { id: 'budget', label: 'Find budget reallocation opportunities', detail: 'Where spend is buying less than it could.' },
  { id: 'creative', label: 'Investigate creative fatigue', detail: 'Frequency, view rate and hold against conversion.' },
  { id: 'directions', label: 'Build new creative directions', detail: 'Brief replacements from an existing finding.' },
  { id: 'custom', label: 'Ask a custom question', detail: 'Anything the connected accounts can answer.' },
] as const;

export const ANALYSIS_WINDOW_LABEL = `${WINDOW_START} → ${WINDOW_END}`;
export const COMPARISON_WINDOW_LABEL = `${COMPARE_START} → ${COMPARE_END}`;
export const TOTAL_WINDOW_DAYS = WINDOW_DATES.length;
