import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { env, capabilities, isPlatformAdmin } from '../env.js';
import {
  createOAuthState,
  createSessionToken,
  readOAuthState,
  safeReturnTo,
  sessionCookieOptions,
} from '../auth/session.js';
import { permissionsForRole } from '../auth/rbac.js';
import * as google from '../providers/google.js';
import * as repo from '../graph/repository.js';
import { demoUser } from '../seed/seed.js';
import type { Role, SessionUser } from '../domain/types.js';
import * as sample from '../sample/constants.js';
import { requireSession, sendError, session } from './context.js';

/**
 * Identity.
 *
 * Signing in establishes who the person is. It never connects an ad account —
 * that is a separate grant with separate scopes, on /api/integrations.
 *
 * Live Google OAuth when a client is configured; a sample identity when
 * ALLOW_DEV_LOGIN permits it. Both end at the same session cookie and the same
 * membership lookup, so nothing downstream cares which one ran.
 */

const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
]);

function domainOf(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'workspace'
  );
}

/**
 * Decides where a newly authenticated person lands.
 *
 * An existing member keeps their workspaces. Otherwise, in order: join a
 * workspace their work domain already owns if that is permitted, provision
 * their own if that is permitted, or land read-only in the sample workspace so
 * a demo sign-in still shows the product.
 */
async function resolveMembership(user: SessionUser): Promise<void> {
  const existing = await repo.listWorkspacesForUser(user.id);
  if (existing.length > 0) return;

  const domain = domainOf(user.email);
  const corporate = domain && !PERSONAL_DOMAINS.has(domain);

  if (env.platform.allowDomainAutoJoin && corporate) {
    const match = await repo.findWorkspaceByDomain(domain);
    if (match) {
      await repo.setMembership(user.id, match.id, 'viewer');
      return;
    }
  }

  if (env.platform.autoProvisionTenant) {
    const label = corporate ? domain.split('.')[0] : user.name;
    const base = slugify(label);
    let slug = base;
    let attempt = 1;
    while (await repo.getWorkspaceBySlug(slug)) {
      attempt += 1;
      slug = `${base}-${attempt}`;
    }

    const workspace = await repo.upsertWorkspace({
      id: `ws_${randomUUID().slice(0, 8)}`,
      slug,
      name: corporate ? `${label[0].toUpperCase()}${label.slice(1)}` : `${user.name}'s workspace`,
      defaultCurrency: 'INR',
      timeZone: 'Asia/Kolkata',
      isSample: false,
      activeAccountCount: 0,
      domain: corporate ? domain : undefined,
    });

    // The person who provisions a workspace owns it.
    await repo.setMembership(user.id, workspace.id, 'owner');
    await repo.recordAudit(workspace.id, {
      id: `aud_${randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      actor: user.name,
      action: 'created the workspace',
      target: workspace.name,
      context: `Provisioned on first sign-in by ${user.email}`,
    });
    return;
  }

  const fallback = await repo.getWorkspaceBySlug(sample.WORKSPACE_SLUG);
  if (fallback) await repo.setMembership(user.id, fallback.id, 'viewer');
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/config', async () => ({
    identity: capabilities().identity,
    /** False while AUTH_ENABLED=false: there is nothing to sign in to. */
    authEnabled: env.auth.enabled,
    rbacEnabled: env.auth.rbacEnabled,
    googleConfigured: env.auth.enabled && google.identityConfigured(),
    /**
     * ALLOW_DEV_LOGIN is honoured as written, including alongside a live
     * Google client — a demo often needs to enter the product without
     * spending a real identity. The sign-in surface labels it plainly rather
     * than hiding it behind the Google button.
     */
    devLoginAllowed: env.auth.enabled && env.platform.allowDevLogin,
    signInLabel: !env.auth.enabled
      ? 'Enter the workspace'
      : google.identityConfigured()
      ? 'Continue with Google'
      : env.platform.allowDevLogin
        ? 'Continue in the sample workspace'
        : 'Sign-in is unavailable',
    devLoginLabel: 'Continue in the sample workspace',
  }));

  app.get('/api/auth/session', async (request, reply) => {
    try {
      const payload = session(request);
      if (!payload) return reply.status(200).send({ authenticated: false });

      const workspaces = await repo.listWorkspacesForUser(payload.user.id);
      return {
        authenticated: true,
        user: payload.user,
        csrfToken: payload.csrf,
        workspaces,
        isPlatformAdmin: isPlatformAdmin(payload.user.email),
        permissionsByWorkspace: Object.fromEntries(
          workspaces.map((workspace) => [workspace.slug, permissionsForRole(workspace.role)]),
        ),
        capabilities: capabilities(),
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** Starts the Google identity grant, or signs the sample identity in. */
  app.get<{ Querystring: { returnTo?: string } }>('/api/auth/google/start', async (request, reply) => {
    const returnTo = safeReturnTo(request.query.returnTo);

    // With auth off there is no grant to start; the visitor is already inside.
    if (!env.auth.enabled) {
      const user = await repo.upsertUser(demoUser);
      await resolveMembership(user);
      return reply.redirect(`${env.siteUrl}${returnTo}`);
    }

    if (!google.identityConfigured()) {
      if (!env.platform.allowDevLogin) {
        return reply.redirect(`${env.siteUrl}/signin?error=sign_in_is_not_configured`);
      }
      const user = await repo.upsertUser(demoUser);
      await resolveMembership(user);
      const { token } = createSessionToken(user);
      reply.setCookie(env.session.cookieName, token, sessionCookieOptions);
      return reply.redirect(`${env.siteUrl}${returnTo}`);
    }

    const state = createOAuthState({ returnTo, kind: 'identity' });
    return reply.redirect(google.identityAuthorizeUrl(state));
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/api/auth/google/callback',
    async (request, reply) => {
      const { code, state, error } = request.query;
      const parsed = readOAuthState(state);
      const returnTo = safeReturnTo(parsed?.returnTo);

      if (error || !code || !parsed) {
        const reason = error ?? (parsed ? 'missing_code' : 'invalid_state');
        return reply.redirect(`${env.siteUrl}/signin?error=${encodeURIComponent(reason)}`);
      }

      try {
        const token = await google.exchangeCode(code, env.google.authRedirectPath, 'identity');
        const profile = await google.fetchGoogleProfile(token.access_token);

        // An existing member with this email keeps their identity and role.
        const existing = await repo.findUserByEmail(profile.email);
        const user = await repo.upsertUser({
          ...profile,
          id: existing?.id ?? profile.id,
          title: existing?.title ?? profile.title,
        });

        await resolveMembership(user);

        const { token: sessionToken } = createSessionToken(user);
        reply.setCookie(env.session.cookieName, sessionToken, sessionCookieOptions);
        return reply.redirect(`${env.siteUrl}${returnTo}`);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'sign_in_failed';
        request.log.error({ err: cause }, 'google identity callback failed');
        return reply.redirect(`${env.siteUrl}/signin?error=${encodeURIComponent(message.slice(0, 120))}`);
      }
    },
  );

  /** Sample sign-in. Available only while ALLOW_DEV_LOGIN is set. */
  app.post('/api/auth/demo', async (request, reply) => {
    if (!env.auth.enabled) {
      const user = await repo.upsertUser(demoUser);
      await resolveMembership(user);
      return { authenticated: true, user, csrfToken: 'open', workspaces: await repo.listWorkspacesForUser(user.id) };
    }
    if (!env.platform.allowDevLogin) {
      return reply.status(400).send({
        error: {
          code: 'validation',
          message: 'Sample sign-in is disabled. Set ALLOW_DEV_LOGIN=true to enable it.',
          retryable: false,
        },
      });
    }
    const user = await repo.upsertUser(demoUser);
    await resolveMembership(user);
    const { token, payload } = createSessionToken(user);
    reply.setCookie(env.session.cookieName, token, sessionCookieOptions);
    const workspaces = await repo.listWorkspacesForUser(user.id);
    return { authenticated: true, user, csrfToken: payload.csrf, workspaces };
  });

  app.post('/api/auth/signout', async (request, reply) => {
    try {
      requireSession(request);
    } catch {
      /* signing out without a session is not an error */
    }
    reply.clearCookie(env.session.cookieName, { path: '/', domain: env.session.domain });
    return { authenticated: false };
  });
}

export type { Role };
