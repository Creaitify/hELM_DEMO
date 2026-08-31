import { env } from '../env.js';
import type { AdAccount } from '../domain/types.js';

/**
 * Meta Ads.
 *
 * A first-class provider, not a badge on a Google screen. The connect sequence
 * asks only for what the read-only performance flow needs: authorize, choose a
 * business portfolio when there is more than one, choose ad accounts, confirm
 * the scope, sync. No Page, pixel, catalogue or dataset is requested here.
 */

const READ_SCOPES = ['ads_read', 'business_management'];

export function metaConfigured(): boolean {
  return Boolean(env.meta.appId && env.meta.appSecret);
}

function graph(path: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `https://graph.facebook.com/${env.meta.apiVersion}/${path}?${search.toString()}`;
}

export function metaAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.meta.appId,
    redirect_uri: `${env.apiUrl}${env.meta.redirectPath}`,
    state,
    response_type: 'code',
    scope: READ_SCOPES.join(','),
  });
  if (env.meta.configId) params.set('config_id', env.meta.configId);
  return `https://www.facebook.com/${env.meta.apiVersion}/dialog/oauth?${params.toString()}`;
}

export type MetaToken = { access_token: string; expires_in?: number; token_type?: string };

export async function exchangeMetaCode(code: string): Promise<MetaToken> {
  const url = graph('oauth/access_token', {
    client_id: env.meta.appId,
    client_secret: env.meta.appSecret,
    redirect_uri: `${env.apiUrl}${env.meta.redirectPath}`,
    code,
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meta token exchange failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as MetaToken;
}

/** Short-lived user tokens are traded for a long-lived one before storage. */
export async function exchangeForLongLivedToken(shortLived: string): Promise<MetaToken> {
  const url = graph('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: env.meta.appId,
    client_secret: env.meta.appSecret,
    fb_exchange_token: shortLived,
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meta long-lived exchange failed: ${response.status}`);
  return (await response.json()) as MetaToken;
}

export type MetaIdentity = { id: string; name: string };

export async function fetchMetaIdentity(accessToken: string): Promise<MetaIdentity> {
  const response = await fetch(graph('me', { fields: 'id,name', access_token: accessToken }));
  if (!response.ok) throw new Error(`Meta identity lookup failed: ${response.status}`);
  return (await response.json()) as MetaIdentity;
}

export type MetaBusiness = { id: string; name: string };

export async function listBusinesses(accessToken: string): Promise<MetaBusiness[]> {
  const response = await fetch(graph('me/businesses', { fields: 'id,name', limit: '50', access_token: accessToken }));
  if (!response.ok) return [];
  const body = (await response.json()) as { data?: MetaBusiness[] };
  return body.data ?? [];
}

export type MetaAdAccount = {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number;
  business?: { id: string; name: string };
};

const META_ACCOUNT_FIELDS = 'id,account_id,name,currency,timezone_name,account_status,business';

export async function listMetaAdAccounts(accessToken: string, businessId?: string): Promise<MetaAdAccount[]> {
  const path = businessId ? `${businessId}/owned_ad_accounts` : 'me/adaccounts';
  const response = await fetch(
    graph(path, { fields: META_ACCOUNT_FIELDS, limit: '100', access_token: accessToken }),
  );
  if (!response.ok) throw new Error(`Meta ad account list failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as { data?: MetaAdAccount[] };
  return body.data ?? [];
}

/** 1 is active; everything else means the account cannot currently serve. */
function statusOf(accountStatus: number): AdAccount['status'] {
  if (accountStatus === 1) return 'active';
  if (accountStatus === 2 || accountStatus === 3) return 'disabled';
  return 'attention';
}

export function metaAccountToAdAccount(account: MetaAdAccount, connectionId: string): AdAccount {
  return {
    id: `acct_m_${account.account_id}`,
    provider: 'meta_ads',
    nativeId: account.account_id,
    name: account.name,
    parentLabel: account.business?.name,
    currency: account.currency,
    timeZone: account.timezone_name,
    status: statusOf(account.account_status),
    connectionId,
    lastSyncedAt: null,
    health: { state: 'never_synced', lastSuccessfulSyncAt: null },
  };
}

/** Plain-language account-state copy for the connection ledger. */
export const META_ACCOUNT_STATE_COPY: Record<number, string> = {
  1: 'Active and readable.',
  2: 'Disabled by Meta. HELM can read history but no new delivery will arrive.',
  3: 'Unsettled. Billing needs attention inside Meta before delivery resumes.',
  7: 'Pending review inside Meta.',
  8: 'Pending closure.',
  9: 'In grace period.',
  100: 'Pending closure. Stored history remains readable.',
  101: 'Closed.',
  201: 'Any active review is complete.',
};
