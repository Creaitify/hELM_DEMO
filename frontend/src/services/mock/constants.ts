import type {
  AccountGroup,
  AccountScope,
  AdAccount,
  Connection,
  ConnectorDefinition,
  DataBasis,
  ScopeSnapshot,
  Workspace,
} from '@/contracts';

/**
 * Canonical sample workspace.
 *
 * Everything below is illustrative sample data for the Northstar Group
 * demonstration workspace. It is labelled as sample wherever a visitor could
 * mistake it for real customer proof.
 */

/** Fixed reference instant so server and client render identical relative times. */
export const NOW_ISO = '2026-08-24T09:12:00+05:30';
export const TODAY = '2026-08-24';
export const HUMAN_TODAY = 'Monday, 24 August';

/** The most recent 30 complete Asia/Kolkata reporting days. */
export const WINDOW_START = '2026-07-25';
export const WINDOW_END = '2026-08-23';
export const COMPARE_START = '2026-06-25';
export const COMPARE_END = '2026-07-24';
export const COMPLETE_THROUGH = '2026-08-23';

export const WINDOW_LABEL = 'Last 30 complete days';
export const COMPARE_LABEL = 'Previous 30 days';

export const WORKSPACE_SLUG = 'northstar-group';

export const workspaces: Workspace[] = [
  {
    id: 'ws_northstar',
    slug: 'northstar-group',
    name: 'Northstar Group',
    defaultCurrency: 'INR',
    timeZone: 'Asia/Kolkata',
    role: 'owner',
    isSample: true,
    activeAccountCount: 5,
  },
  {
    id: 'ws_meridian',
    slug: 'meridian-labs',
    name: 'Meridian Labs',
    defaultCurrency: 'INR',
    timeZone: 'Asia/Kolkata',
    role: 'analyst',
    isSample: true,
    activeAccountCount: 2,
  },
  {
    id: 'ws_harbour',
    slug: 'harbour-and-co',
    name: 'Harbour & Co',
    defaultCurrency: 'GBP',
    timeZone: 'Europe/London',
    role: 'viewer',
    isSample: true,
    activeAccountCount: 3,
    attention: 'Meta Ads needs reauthorization',
  },
];

export const currentWorkspace = workspaces[0];

export const currentUser = {
  id: 'usr_aniket',
  name: 'Aniket Rao',
  email: 'aniket@northstargroup.in',
  role: 'owner' as const,
  title: 'Performance lead',
};

export const accounts: AdAccount[] = [
  {
    id: 'acct_g_search',
    provider: 'google_ads',
    nativeId: '187-DEM-9021',
    name: 'Northstar India / Search',
    parentLabel: 'Northstar Group MCC',
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    status: 'active',
    connectionId: 'con_google',
    lastSyncedAt: '2026-08-24T09:04:00+05:30',
    health: {
      state: 'fresh',
      lastSuccessfulSyncAt: '2026-08-24T09:04:00+05:30',
      nextScheduledSyncAt: '2026-08-24T13:00:00+05:30',
    },
  },
  {
    id: 'acct_g_pmax',
    provider: 'google_ads',
    nativeId: '605-DEM-7740',
    name: 'Northstar India / Performance Max',
    parentLabel: 'Northstar Group MCC',
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    status: 'active',
    connectionId: 'con_google',
    lastSyncedAt: '2026-08-24T09:04:00+05:30',
    health: {
      state: 'fresh',
      lastSuccessfulSyncAt: '2026-08-24T09:04:00+05:30',
      nextScheduledSyncAt: '2026-08-24T13:00:00+05:30',
    },
  },
  {
    id: 'acct_m_prospect',
    provider: 'meta_ads',
    nativeId: '2385-DEMO-2110',
    name: 'Northstar India / Prospecting',
    parentLabel: 'Northstar Hydration portfolio',
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    status: 'active',
    connectionId: 'con_meta',
    lastSyncedAt: '2026-08-24T08:58:00+05:30',
    health: {
      state: 'fresh',
      lastSuccessfulSyncAt: '2026-08-24T08:58:00+05:30',
      nextScheduledSyncAt: '2026-08-24T12:58:00+05:30',
    },
  },
  {
    id: 'acct_m_retarget',
    provider: 'meta_ads',
    nativeId: '2385-DEMO-2911',
    name: 'Northstar India / Retargeting',
    parentLabel: 'Northstar Hydration portfolio',
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    status: 'attention',
    connectionId: 'con_meta',
    lastSyncedAt: '2026-08-23T14:20:00+05:30',
    health: {
      state: 'delayed',
      lastSuccessfulSyncAt: '2026-08-23T14:20:00+05:30',
      nextScheduledSyncAt: '2026-08-24T12:58:00+05:30',
      message: 'Meta reporting is 19 hours behind for this account. Totals exclude it.',
    },
  },
  {
    id: 'acct_g_us',
    provider: 'google_ads',
    nativeId: '792-DEM-3504',
    name: 'Northstar US / Search',
    parentLabel: 'Northstar Group MCC',
    currency: 'USD',
    timeZone: 'America/New_York',
    status: 'active',
    connectionId: 'con_google',
    lastSyncedAt: '2026-08-24T08:41:00+05:30',
    health: {
      state: 'fresh',
      lastSuccessfulSyncAt: '2026-08-24T08:41:00+05:30',
      nextScheduledSyncAt: '2026-08-24T12:41:00+05:30',
      message: 'Reports in USD on an America/New_York day boundary.',
    },
  },
];

export const accountById = (id: string): AdAccount | undefined =>
  accounts.find((account) => account.id === id);

export const INDIA_ACCOUNT_IDS = ['acct_g_search', 'acct_g_pmax', 'acct_m_prospect', 'acct_m_retarget'];
export const BLENDED_ACCOUNT_IDS = ['acct_g_search', 'acct_g_pmax', 'acct_m_prospect'];

export const DEFAULT_SCOPE_ID = 'scp_demo_paid_india';

export const scopes: AccountScope[] = [
  {
    id: DEFAULT_SCOPE_ID,
    kind: 'group',
    label: 'India · Google + Meta',
    accountIds: INDIA_ACCOUNT_IDS,
  },
  {
    id: 'scp_all_compatible',
    kind: 'all-compatible',
    label: 'All compatible accounts',
    accountIds: INDIA_ACCOUNT_IDS,
  },
  {
    id: 'scp_google_only',
    kind: 'selection',
    label: 'Google Ads only',
    accountIds: ['acct_g_search', 'acct_g_pmax'],
  },
  {
    id: 'scp_meta_only',
    kind: 'selection',
    label: 'Meta Ads only',
    accountIds: ['acct_m_prospect', 'acct_m_retarget'],
  },
  {
    id: 'scp_high_intent',
    kind: 'selection',
    label: 'Northstar India / Search',
    accountIds: ['acct_g_search'],
  },
  {
    id: 'scp_us_search',
    kind: 'selection',
    label: 'Northstar US / Search',
    accountIds: ['acct_g_us'],
  },
];

export const scopeById = (id: string): AccountScope =>
  scopes.find((scope) => scope.id === id) ?? scopes[0];

export const savedGroups: AccountGroup[] = [
  { id: 'scp_demo_paid_india', label: 'India · Google + Meta', accountIds: INDIA_ACCOUNT_IDS, createdBy: 'Aniket Rao' },
  { id: 'grp_search_only', label: 'Search intent only', accountIds: ['acct_g_search'], createdBy: 'Priya Menon' },
  {
    id: 'grp_global',
    label: 'Global rollup',
    accountIds: [...INDIA_ACCOUNT_IDS, 'acct_g_us'],
    createdBy: 'Aniket Rao',
  },
];

export const recentScopeIds = ['scp_demo_paid_india', 'scp_meta_only', 'scp_high_intent'];

export const defaultScopeSnapshot: ScopeSnapshot = {
  scopeId: DEFAULT_SCOPE_ID,
  label: 'India · Google + Meta',
  accountIds: INDIA_ACCOUNT_IDS,
  resolvedAt: NOW_ISO,
  schemaVersion: 3,
};

/**
 * The analytical basis for every blended number in the sample workspace.
 * Northstar US is separated for currency and reporting-day reasons; Meta
 * Retargeting is excluded from totals while its sync is behind.
 */
export const primaryBasis: DataBasis = {
  accountIds: BLENDED_ACCOUNT_IDS,
  startDateInclusive: WINDOW_START,
  endDateInclusive: WINDOW_END,
  comparisonStartDateInclusive: COMPARE_START,
  comparisonEndDateInclusive: COMPARE_END,
  completeThroughDate: COMPLETE_THROUGH,
  accountBasis: [
    {
      accountId: 'acct_g_search',
      provider: 'google_ads',
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      attributionLabel: 'Primary Purchase · 7-day click',
      freshness: accounts[0].health,
    },
    {
      accountId: 'acct_g_pmax',
      provider: 'google_ads',
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      attributionLabel: 'Primary Purchase · 7-day click',
      freshness: accounts[1].health,
    },
    {
      accountId: 'acct_m_prospect',
      provider: 'meta_ads',
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      attributionLabel: 'Purchase · 7-day click',
      freshness: accounts[2].health,
    },
  ],
  aggregation: { state: 'compatible' },
  exclusions: [
    'Northstar US / Search is separated: USD and an America/New_York reporting day.',
    'Northstar India / Retargeting is excluded from totals while its sync is 19 hours behind.',
    'The current partial day (24 August) is excluded from every figure.',
  ],
};

export const connectors: ConnectorDefinition[] = [
  {
    key: 'google_ads',
    label: 'Google Ads',
    accountNoun: 'ad account',
    supportsMultipleAccounts: true,
    capabilities: ['campaigns', 'ad_groups', 'ads', 'keywords', 'daily_metrics'],
    setupSteps: ['Authorize Google', 'Choose manager account', 'Choose ad accounts', 'Begin initial sync'],
    readsPlainLanguage: [
      'Campaign, ad group, keyword and ad performance',
      'Daily spend, impressions, clicks and conversions',
      'Conversion action names and their attribution settings',
    ],
    neverDoes: [
      'Change budgets, bids, or campaign status',
      'Create, pause, or delete anything in your account',
    ],
  },
  {
    key: 'meta_ads',
    label: 'Meta Ads',
    accountNoun: 'ad account',
    supportsMultipleAccounts: true,
    capabilities: ['campaigns', 'ad_groups', 'ads', 'creative', 'daily_metrics'],
    setupSteps: [
      'Authorize Meta',
      'Choose business portfolio',
      'Choose ad accounts',
      'Confirm initial scope',
      'Begin initial sync',
    ],
    readsPlainLanguage: [
      'Campaign, ad set and ad performance',
      'Daily spend, impressions, reach, frequency and purchases',
      'Creative assets and video engagement metrics',
    ],
    neverDoes: [
      'Change budgets, bids, or delivery',
      'Post, comment, or message from your Page',
      'Read pixel, catalogue, or customer data in this flow',
    ],
  },
  {
    key: 'upload',
    label: 'File import',
    accountNoun: 'file',
    supportsMultipleAccounts: false,
    capabilities: ['daily_metrics'],
    setupSteps: ['Upload a CSV', 'Map columns', 'Confirm currency and timezone'],
    readsPlainLanguage: ['Only the rows and columns you map'],
    neverDoes: ['Send your file to any ad platform'],
  },
];

export const connections: Connection[] = [
  {
    id: 'con_google',
    provider: 'google_ads',
    status: 'connected',
    identityLabel: 'aniket@northstargroup.in · Northstar Group MCC',
    accessibleAccounts: 9,
    selectedAccounts: 3,
    lastSyncAt: '2026-08-24T09:04:00+05:30',
    nextSyncAt: '2026-08-24T13:00:00+05:30',
    grantedReads: [
      'Campaign, ad group, keyword and ad performance',
      'Daily spend and conversion metrics',
      'Conversion action definitions',
    ],
  },
  {
    id: 'con_meta',
    provider: 'meta_ads',
    status: 'attention',
    identityLabel: 'Aniket Rao · Northstar Hydration portfolio',
    accessibleAccounts: 4,
    selectedAccounts: 2,
    lastSyncAt: '2026-08-24T08:58:00+05:30',
    nextSyncAt: '2026-08-24T12:58:00+05:30',
    grantedReads: [
      'Campaign, ad set and ad performance',
      'Daily spend, reach, frequency and purchases',
      'Creative assets and video engagement',
    ],
    message: 'Retargeting reporting is 19 hours behind. Prospecting is current.',
  },
  {
    id: 'con_upload',
    provider: 'upload',
    status: 'disconnected',
    identityLabel: 'No files imported',
    accessibleAccounts: 0,
    selectedAccounts: 0,
    lastSyncAt: null,
    nextSyncAt: null,
    grantedReads: [],
  },
];

export const SAMPLE_NOTE = 'Illustrative sample workspace. No customer data is shown.';
