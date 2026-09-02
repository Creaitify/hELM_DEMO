import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { createOAuthState, readOAuthState, safeReturnTo } from '../auth/session.js';
import * as repo from '../graph/repository.js';
import * as google from '../providers/google.js';
import * as meta from '../providers/meta.js';
import type { AdAccount, Connection, ProviderKey } from '../domain/types.js';
import { connectors } from '../sample/constants.js';
import { invalid, notFound, requireCsrf, requireWorkspace, sendError } from './context.js';

/**
 * Connections.
 *
 * Connect and disconnect are explicit verbs with consequences, never a toggle.
 * Provider tokens are exchanged here and stored against the connection node;
 * they never reach the browser. When a provider is not configured the same
 * flow runs against the sample portfolio, so the sequence, the states and the
 * copy are exactly what a live grant will produce.
 */

const PROVIDER_LABEL: Record<ProviderKey, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  upload: 'File import',
};

/** Sample portfolios used when a provider app is not configured. */
const SAMPLE_PORTFOLIOS = {
  meta_ads: [
    { id: 'bus_northstar', name: 'Northstar Hydration portfolio' },
    { id: 'bus_meridian', name: 'Meridian Labs portfolio' },
  ],
  google_ads: [{ id: 'mcc_northstar', name: 'Northstar Group MCC' }],
};

const SAMPLE_ACCOUNTS: Record<'google_ads' | 'meta_ads', Omit<AdAccount, 'connectionId'>[]> = {
  google_ads: [
    {
      id: 'acct_g_search',
      provider: 'google_ads',
      nativeId: '187-DEM-9021',
      name: 'Northstar India / Search',
      parentLabel: 'Northstar Group MCC',
      currency: 'INR',
      timeZone: 'Asia/Kolkata',
      status: 'active',
      lastSyncedAt: null,
      health: { state: 'never_synced', lastSuccessfulSyncAt: null },
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
      lastSyncedAt: null,
      health: { state: 'never_synced', lastSuccessfulSyncAt: null },
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
      lastSyncedAt: null,
      health: { state: 'never_synced', lastSuccessfulSyncAt: null },
    },
  ],
  meta_ads: [
    {
      id: 'acct_m_prospect',
      provider: 'meta_ads',
      nativeId: '2385-DEMO-2110',
      name: 'Northstar India / Prospecting',
      parentLabel: 'Northstar Hydration portfolio',
      currency: 'INR',
      timeZone: 'Asia/Kolkata',
      status: 'active',
      lastSyncedAt: null,
      health: { state: 'never_synced', lastSuccessfulSyncAt: null },
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
      lastSyncedAt: null,
      health: {
        state: 'delayed',
        lastSuccessfulSyncAt: null,
        message: 'Meta reporting for this account runs behind. Totals exclude it until it catches up.',
      },
    },
    {
      id: 'acct_m_creators',
      provider: 'meta_ads',
      nativeId: '2385-DEMO-3307',
      name: 'Northstar / Creator collaborations',
      parentLabel: 'Northstar Hydration portfolio',
      currency: 'INR',
      timeZone: 'Asia/Kolkata',
      status: 'disabled',
      lastSyncedAt: null,
      health: {
        state: 'failed',
        lastSuccessfulSyncAt: null,
        message: 'Meta has this ad account disabled. HELM can read history but no new delivery will arrive.',
      },
    },
  ],
};

/** A real provider consent screen can be shown for this provider. */
function providerConfigured(provider: ProviderKey): boolean {
  if (provider === 'google_ads') return google.adsConfigured();
  if (provider === 'meta_ads') return meta.metaConfigured();
  return true;
}

/**
 * A real grant exists but reads come from the sample portfolio. True for
 * Google Ads while GOOGLE_ADS_MOCK is set or the developer token is still on
 * basic access — the flow is live, the data is not, and the ledger says so.
 */
function providerReadsAreMocked(provider: ProviderKey): boolean {
  if (provider === 'google_ads') return google.adsReadsAreMocked();
  return false;
}

function connectionId(provider: ProviderKey): string {
  return provider === 'google_ads' ? 'con_google' : provider === 'meta_ads' ? 'con_meta' : 'con_upload';
}

async function audit(workspaceId: string, actor: string, action: string, target: string, note: string) {
  await repo.recordAudit(workspaceId, {
    id: `aud_${randomUUID().slice(0, 8)}`,
    at: new Date().toISOString(),
    actor,
    action,
    target,
    context: note,
  });
}

export async function connectionRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/connections', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'connections.read');
      const [connections, accounts] = await Promise.all([
        repo.listConnections(context.workspace.id),
        repo.listAccounts(context.workspace.id),
      ]);

      return {
        connections,
        accounts,
        connectors,
        canManage: context.can('connections.manage'),
        canDeleteData: context.can('connections.delete_data'),
        providerConfiguration: {
          google_ads: {
            live: google.adsConfigured() && !google.adsReadsAreMocked(),
            note: !google.adsConfigured()
              ? 'No Google Ads OAuth client configured — the connect sequence runs against the sample portfolio.'
              : google.adsReadsAreMocked()
                ? 'Live Google consent, sample reporting. The developer token is on basic access or GOOGLE_ADS_MOCK is set, so accounts come from the sample portfolio.'
                : 'Live Google Ads OAuth and reporting.',
          },
          meta_ads: {
            live: meta.metaConfigured(),
            note: meta.metaConfigured()
              ? 'Live Meta OAuth is configured.'
              : 'No Meta app configured — the connect sequence runs against the sample portfolio.',
          },
        },
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /**
   * Step 1 of the connect sequence. Returns either the provider authorization
   * URL to open, or — when the provider is not configured — a resolved sample
   * grant so the rest of the sequence is identical.
   */
  app.post<{ Params: { slug: string; provider: ProviderKey }; Body: { returnTo?: string } }>(
    '/api/workspaces/:slug/connections/:provider/authorize',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'connections.manage');
        const provider = request.params.provider;
        if (provider !== 'google_ads' && provider !== 'meta_ads') {
          throw invalid('That provider does not use OAuth.');
        }

        const id = connectionId(provider);
        const existing = await repo.getConnection(id);
        const returnTo = safeReturnTo(request.body?.returnTo, `/w/${context.workspace.slug}/connections`);

        await repo.upsertConnection(context.workspace.id, {
          ...(existing ?? {
            id,
            provider,
            accessibleAccounts: 0,
            selectedAccounts: 0,
            lastSyncAt: null,
            nextSyncAt: null,
            grantedReads: [],
          }),
          identityLabel: existing?.identityLabel ?? 'Authorization in progress',
          status: 'authorizing',
        } as Connection);

        if (providerConfigured(provider)) {
          const state = createOAuthState({
            kind: provider,
            workspaceId: context.workspace.id,
            workspaceSlug: context.workspace.slug,
            returnTo,
          });
          const url = provider === 'google_ads' ? google.adsAuthorizeUrl(state) : meta.metaAuthorizeUrl(state);
          return { mode: 'redirect' as const, authorizeUrl: url };
        }

        // Sample grant. Identical downstream sequence, clearly labelled.
        await repo.storeGrant(id, {
          accessToken: 'sample',
          accountIdentity: provider === 'google_ads' ? 'Northstar Group MCC' : 'Northstar Hydration portfolio',
        });
        await audit(
          context.workspace.id,
          context.user.name,
          `authorized ${PROVIDER_LABEL[provider]}`,
          PROVIDER_LABEL[provider],
          'Sample authorization — no provider app configured',
        );

        return {
          mode: 'sample' as const,
          portfolios: SAMPLE_PORTFOLIOS[provider],
          note:
            provider === 'meta_ads'
              ? 'No Meta app is configured, so the sample portfolio is used. The steps, states and copy are the live ones.'
              : 'No Google Ads developer token is configured, so the sample manager account is used.',
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** Step 2/3. Lists the ad accounts a grant can reach, under a portfolio. */
  app.get<{ Params: { slug: string; provider: ProviderKey }; Querystring: { portfolio?: string } }>(
    '/api/workspaces/:slug/connections/:provider/accounts',
    async (request, reply) => {
      try {
        await requireWorkspace(request, request.params.slug, 'connections.manage');
        const provider = request.params.provider;
        if (provider !== 'google_ads' && provider !== 'meta_ads') throw invalid('Unknown provider.');

        const id = connectionId(provider);
        const grant = await repo.readGrant(id);
        if (!grant) throw invalid('Authorize the provider before choosing accounts.');

        if (
          grant.accessToken === 'sample' ||
          !providerConfigured(provider) ||
          providerReadsAreMocked(provider)
        ) {
          return {
            live: false,
            portfolios: SAMPLE_PORTFOLIOS[provider],
            accounts: SAMPLE_ACCOUNTS[provider].map((account) => ({ ...account, connectionId: id })),
            accountStateCopy: provider === 'meta_ads' ? meta.META_ACCOUNT_STATE_COPY : undefined,
            note:
              grant.accessToken === 'sample'
                ? undefined
                : 'Authorized with your real Google account. Reporting comes from the sample portfolio until the developer token has standard access.',
          };
        }

        if (provider === 'meta_ads') {
          const businesses = await meta.listBusinesses(grant.accessToken);
          const accounts = await meta.listMetaAdAccounts(grant.accessToken, request.query.portfolio);
          return {
            live: true,
            portfolios: businesses,
            accounts: accounts.map((account) => meta.metaAccountToAdAccount(account, id)),
            accountStateCopy: meta.META_ACCOUNT_STATE_COPY,
          };
        }

        const customers = await google.listAccessibleCustomers(grant.accessToken);
        return {
          live: true,
          portfolios: customers
            .filter((customer) => customer.manager)
            .map((customer) => ({ id: customer.id, name: customer.descriptiveName })),
          accounts: customers
            .filter((customer) => !customer.manager)
            .map((customer) => google.customerToAccount(customer, id)),
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** Step 4/5. Commits the selected accounts and starts the initial sync. */
  app.post<{ Params: { slug: string; provider: ProviderKey }; Body: { accountIds?: string[]; portfolio?: string } }>(
    '/api/workspaces/:slug/connections/:provider/select',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'connections.manage');
        const provider = request.params.provider;
        if (provider !== 'google_ads' && provider !== 'meta_ads') throw invalid('Unknown provider.');

        const accountIds = request.body?.accountIds ?? [];
        if (accountIds.length === 0) throw invalid('Choose at least one ad account.', 'accountIds');

        const id = connectionId(provider);
        const grant = await repo.readGrant(id);
        if (!grant) throw invalid('Authorize the provider before choosing accounts.');

        const available =
          grant.accessToken === 'sample' ||
          !providerConfigured(provider) ||
          providerReadsAreMocked(provider)
            ? SAMPLE_ACCOUNTS[provider].map((account) => ({ ...account, connectionId: id }))
            : provider === 'meta_ads'
              ? (await meta.listMetaAdAccounts(grant.accessToken, request.body?.portfolio)).map((account) =>
                  meta.metaAccountToAdAccount(account, id),
                )
              : (await google.listAccessibleCustomers(grant.accessToken))
                  .filter((customer) => !customer.manager)
                  .map((customer) => google.customerToAccount(customer, id));

        const chosen = available.filter((account) => accountIds.includes(account.id));
        if (chosen.length === 0) throw invalid('None of those accounts are reachable with this grant.', 'accountIds');

        const syncedAt = new Date().toISOString();
        for (const account of chosen) {
          await repo.upsertAccount({
            ...account,
            selected: true,
            lastSyncedAt: account.health.state === 'never_synced' ? syncedAt : account.lastSyncedAt,
            health:
              account.health.state === 'never_synced'
                ? { state: 'syncing', lastSuccessfulSyncAt: null, message: 'Initial sync in progress.' }
                : account.health,
          });
        }

        const connector = connectors.find((entry) => entry.key === provider);
        const attention = chosen.filter((account) => account.status !== 'active').length;

        const connection: Connection = {
          id,
          provider,
          status: attention > 0 ? 'attention' : 'syncing',
          identityLabel: grant.accountIdentity ?? `${PROVIDER_LABEL[provider]} connection`,
          accessibleAccounts: available.length,
          selectedAccounts: chosen.length,
          lastSyncAt: syncedAt,
          nextSyncAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          grantedReads: connector?.readsPlainLanguage ?? [],
          message:
            attention > 0
              ? `${attention} selected account${attention > 1 ? 's need' : ' needs'} attention inside ${PROVIDER_LABEL[provider]}.`
              : 'Initial sync started. You can leave this page.',
          live: grant.accessToken !== 'sample',
        };
        await repo.upsertConnection(context.workspace.id, connection);

        await repo.upsertTimelineEvent(context.workspace.id, {
          id: `tl_${randomUUID().slice(0, 8)}`,
          at: syncedAt,
          kind: 'connection',
          title: `${PROVIDER_LABEL[provider]} connected`,
          detail: `${chosen.length} ad account${chosen.length > 1 ? 's' : ''} selected. Initial sync started.`,
          tone: 'good',
        });
        await audit(
          context.workspace.id,
          context.user.name,
          `connected ${PROVIDER_LABEL[provider]}`,
          chosen.map((account) => account.nativeId).join(', '),
          `${chosen.length} accounts selected`,
        );

        // The initial sync settles shortly after; the ledger polls for it.
        setTimeout(() => {
          void (async () => {
            for (const account of chosen) {
              if (account.health.state !== 'never_synced' && account.health.state !== 'syncing') continue;
              await repo.upsertAccount({
                ...account,
                selected: true,
                lastSyncedAt: new Date().toISOString(),
                health: {
                  state: account.status === 'active' ? 'fresh' : 'partial',
                  lastSuccessfulSyncAt: new Date().toISOString(),
                  nextScheduledSyncAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
                  message: account.status === 'active' ? undefined : account.health.message,
                },
              });
            }
            await repo.upsertConnection(context.workspace.id, {
              ...connection,
              status: attention > 0 ? 'attention' : 'connected',
              message: attention > 0 ? connection.message : undefined,
            });
          })().catch(() => undefined);
        }, 6000);

        return { connection, accounts: chosen };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post<{ Params: { slug: string; provider: ProviderKey } }>(
    '/api/workspaces/:slug/connections/:provider/sync',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'connections.manage');
        const id = connectionId(request.params.provider);
        const connection = await repo.getConnection(id);
        if (!connection) throw notFound('That connection does not exist.');

        const at = new Date().toISOString();
        await repo.upsertConnection(context.workspace.id, {
          ...connection,
          status: 'syncing',
          lastSyncAt: at,
          message: 'Manual sync requested.',
        });

        setTimeout(() => {
          void repo
            .upsertConnection(context.workspace.id, {
              ...connection,
              status: 'connected',
              lastSyncAt: new Date().toISOString(),
              nextSyncAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
              message: undefined,
            })
            .catch(() => undefined);
        }, 5000);

        return { connection: { ...connection, status: 'syncing', lastSyncAt: at } };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post<{ Params: { slug: string; provider: ProviderKey }; Body: { paused?: boolean } }>(
    '/api/workspaces/:slug/connections/:provider/pause',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'connections.manage');
        const id = connectionId(request.params.provider);
        const connection = await repo.getConnection(id);
        if (!connection) throw notFound('That connection does not exist.');

        const paused = request.body?.paused ?? connection.status !== 'paused';
        const updated: Connection = {
          ...connection,
          status: paused ? 'paused' : 'connected',
          message: paused ? 'Scheduled syncs are paused. Stored history is unchanged.' : undefined,
        };
        await repo.upsertConnection(context.workspace.id, updated);
        return { connection: updated };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /**
   * Disconnect stops future syncs. It never deletes stored history — that is a
   * separate, stronger confirmation on a separate route.
   */
  app.post<{ Params: { slug: string; provider: ProviderKey } }>(
    '/api/workspaces/:slug/connections/:provider/disconnect',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'connections.manage');
        const provider = request.params.provider;
        const id = connectionId(provider);
        const connection = await repo.getConnection(id);
        if (!connection) throw notFound('That connection does not exist.');

        await repo.deleteGrant(id);
        const updated: Connection = {
          ...connection,
          status: 'disconnected',
          selectedAccounts: 0,
          nextSyncAt: null,
          live: false,
          message: 'Future syncs have stopped. Stored history remains available until you delete it.',
        };
        await repo.upsertConnection(context.workspace.id, updated);

        await audit(
          context.workspace.id,
          context.user.name,
          `disconnected ${PROVIDER_LABEL[provider]}`,
          PROVIDER_LABEL[provider],
          'Stored history retained',
        );

        return { connection: updated };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** Destructive and owner-only. Removes the accounts this connection provided. */
  app.post<{ Params: { slug: string; provider: ProviderKey }; Body: { confirm?: string } }>(
    '/api/workspaces/:slug/connections/:provider/delete-data',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'connections.delete_data');
        const provider = request.params.provider;
        const id = connectionId(provider);

        if (request.body?.confirm !== PROVIDER_LABEL[provider]) {
          throw invalid(`Type “${PROVIDER_LABEL[provider]}” to confirm.`, 'confirm');
        }

        // Removes the accounts and delivery this connection provided. The
        // connection row itself stays, disconnected, so the ledger can still
        // explain what happened and when.
        const accounts = await repo.listAccounts(context.workspace.id);
        const affected = accounts.filter((account) => account.connectionId === id);
        for (const account of affected) {
          await repo.deleteAccount(account.id);
        }

        await audit(
          context.workspace.id,
          context.user.name,
          `deleted stored ${PROVIDER_LABEL[provider]} history`,
          affected.map((account) => account.nativeId).join(', '),
          `${affected.length} accounts`,
        );

        return { deleted: affected.length };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /* ------------------------------------------------------- oauth returns -- */

  /**
   * Provider OAuth returns.
   *
   * The paths come from GOOGLE_ADS_REDIRECT_URI and META_REDIRECT_URI, so what
   * this server listens on is always what was registered with the provider.
   */
  const handleCallback = async (
    provider: ProviderKey,
    request: { query: { code?: string; state?: string; error?: string }; log: { error: (o: unknown, m: string) => void } },
    reply: { redirect: (url: string) => unknown },
  ) => {
    const parsed = readOAuthState(request.query.state);
    const returnTo = safeReturnTo(parsed?.returnTo, '/app');
    const back = (status: string) =>
      `${env.siteUrl}${returnTo}${returnTo.includes('?') ? '&' : '?'}connection=${provider}&status=${status}`;

    if (request.query.error || !request.query.code || !parsed) {
      return reply.redirect(back('cancelled'));
    }

    {
      try {
        const id = connectionId(provider);
        if (provider === 'google_ads') {
          const token = await google.exchangeCode(request.query.code, env.google.adsRedirectPath, 'ads');
          await repo.storeGrant(id, {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: token.expires_in
              ? new Date(Date.now() + token.expires_in * 1000).toISOString()
              : undefined,
            scope: token.scope,
            accountIdentity: 'Google Ads',
          });
        } else if (provider === 'meta_ads') {
          const short = await meta.exchangeMetaCode(request.query.code);
          const long = await meta.exchangeForLongLivedToken(short.access_token).catch(() => short);
          const identity = await meta.fetchMetaIdentity(long.access_token).catch(() => ({ name: 'Meta Ads' }));
          await repo.storeGrant(id, {
            accessToken: long.access_token,
            expiresAt: long.expires_in
              ? new Date(Date.now() + long.expires_in * 1000).toISOString()
              : undefined,
            accountIdentity: identity.name,
          });
        } else {
          return reply.redirect(back('cancelled'));
        }

        const connection = await repo.getConnection(id);
        if (connection && parsed.workspaceId) {
          await repo.upsertConnection(parsed.workspaceId, {
            ...connection,
            status: 'authorizing',
            live: true,
          });
        }

        return reply.redirect(back('authorized'));
      } catch (cause) {
        request.log.error({ err: cause }, 'connector callback failed');
        return reply.redirect(back('failed'));
      }
    }
  };

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    env.google.adsRedirectPath,
    async (request, reply) => handleCallback('google_ads', request, reply),
  );

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    env.meta.redirectPath,
    async (request, reply) => handleCallback('meta_ads', request, reply),
  );
}
