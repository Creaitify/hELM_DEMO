import { env } from '../env.js';
import type { AdAccount, SessionUser } from '../domain/types.js';

/**
 * Google identity and Google Ads.
 *
 * Two separate grants with two separate scopes and two separate callbacks.
 * Signing in with Google never connects an ad account, and connecting Google
 * Ads never changes who is signed in.
 */

const IDENTITY_SCOPES = ['openid', 'email', 'profile'];
const ADS_SCOPES = ['https://www.googleapis.com/auth/adwords'];

export function identityConfigured(): boolean {
  return Boolean(env.google.clientId && env.google.clientSecret);
}

/** A real Ads OAuth grant is possible. Reading live data also needs a token. */
export function adsConfigured(): boolean {
  return Boolean(env.google.adsClientId && env.google.adsClientSecret);
}

/**
 * True when the Ads connector should run the real consent flow but read the
 * sample portfolio — the correct behaviour while the developer token is still
 * on basic access, or when GOOGLE_ADS_MOCK is set.
 */
export function adsReadsAreMocked(): boolean {
  return env.google.adsMock || !env.google.adsDeveloperToken;
}

function authorizeUrl(
  scopes: string[],
  redirectUri: string,
  state: string,
  clientId: string,
  extra: Record<string, string> = {},
) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    ...extra,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function identityAuthorizeUrl(state: string): string {
  return authorizeUrl(
    IDENTITY_SCOPES,
    `${env.apiUrl}${env.google.authRedirectPath}`,
    state,
    env.google.clientId,
  );
}

export function adsAuthorizeUrl(state: string): string {
  return authorizeUrl(
    ADS_SCOPES,
    `${env.apiUrl}${env.google.adsRedirectPath}`,
    state,
    env.google.adsClientId,
  );
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
};

export async function exchangeCode(
  code: string,
  redirectPath: string,
  which: 'identity' | 'ads' = 'identity',
): Promise<TokenResponse> {
  const clientId = which === 'ads' ? env.google.adsClientId : env.google.clientId;
  const clientSecret = which === 'ads' ? env.google.adsClientSecret : env.google.clientSecret;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${env.apiUrl}${redirectPath}`,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error(`Google token refresh failed: ${response.status}`);
  return (await response.json()) as TokenResponse;
}

export async function fetchGoogleProfile(accessToken: string): Promise<SessionUser> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Google profile lookup failed: ${response.status}`);
  const profile = (await response.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };
  return {
    id: `usr_g_${profile.sub}`,
    email: profile.email.toLowerCase(),
    name: profile.name ?? profile.email.split('@')[0],
    picture: profile.picture,
    title: 'Member',
    identityProvider: 'google',
  };
}

/* ------------------------------------------------------------ google ads -- */

type ListedCustomer = {
  resourceName: string;
  id: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  manager: boolean;
  status: string;
  managerName?: string;
};

/**
 * Lists every customer the grant can reach, then reads each one's descriptive
 * fields. Google returns resource names only from listAccessibleCustomers, so
 * a second search query per customer is required to get anything readable.
 */
export async function listAccessibleCustomers(accessToken: string): Promise<ListedCustomer[]> {
  const version = env.google.adsApiVersion;
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    'developer-token': env.google.adsDeveloperToken,
    'content-type': 'application/json',
  };
  if (env.google.adsLoginCustomerId) headers['login-customer-id'] = env.google.adsLoginCustomerId;

  const listed = await fetch(`https://googleads.googleapis.com/${version}/customers:listAccessibleCustomers`, {
    headers,
  });
  if (!listed.ok) throw new Error(`Google Ads customer list failed: ${listed.status} ${await listed.text()}`);

  const { resourceNames = [] } = (await listed.json()) as { resourceNames?: string[] };
  const customers: ListedCustomer[] = [];

  for (const resourceName of resourceNames.slice(0, 25)) {
    const customerId = resourceName.split('/')[1];
    const response = await fetch(
      `https://googleads.googleapis.com/${version}/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query:
            'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.status FROM customer LIMIT 1',
        }),
      },
    );
    if (!response.ok) continue;
    const body = (await response.json()) as {
      results?: {
        customer: {
          id: string;
          descriptiveName?: string;
          currencyCode?: string;
          timeZone?: string;
          manager?: boolean;
          status?: string;
        };
      }[];
    };
    const customer = body.results?.[0]?.customer;
    if (!customer) continue;
    customers.push({
      resourceName,
      id: customer.id,
      descriptiveName: customer.descriptiveName ?? `Customer ${customer.id}`,
      currencyCode: customer.currencyCode ?? 'USD',
      timeZone: customer.timeZone ?? 'UTC',
      manager: Boolean(customer.manager),
      status: customer.status ?? 'UNKNOWN',
    });
  }
  return customers;
}

function formatCustomerId(id: string): string {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}

export function customerToAccount(customer: ListedCustomer, connectionId: string): AdAccount {
  return {
    id: `acct_g_${customer.id}`,
    provider: 'google_ads',
    nativeId: formatCustomerId(customer.id),
    name: customer.descriptiveName,
    parentLabel: customer.manager ? 'Manager account' : customer.managerName,
    currency: customer.currencyCode,
    timeZone: customer.timeZone,
    status: customer.status === 'ENABLED' ? 'active' : 'disabled',
    connectionId,
    lastSyncedAt: null,
    health: { state: 'never_synced', lastSuccessfulSyncAt: null },
  };
}
