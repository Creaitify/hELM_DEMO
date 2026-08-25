import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { assignableRoles, permissionsForRole, ROLE_LABEL } from '../auth/rbac.js';
import * as repo from '../graph/repository.js';
import type { Role } from '../domain/types.js';
import { invalid, notFound, requireCsrf, requireSession, requireWorkspace, sendError } from './context.js';
import { preferences } from '../sample/library.js';

/**
 * Workspace, scope, membership and governance surfaces.
 *
 * Every handler resolves the caller's role from the membership edge before it
 * reads anything, and names the permission it needs rather than comparing
 * roles inline.
 */
export async function workspaceRoutes(app: FastifyInstance) {
  app.get('/api/workspaces', async (request, reply) => {
    try {
      const payload = requireSession(request);
      const workspaces = await repo.listWorkspacesForUser(payload.user.id);
      return { workspaces };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'workspace.read');
      const [accounts, scopes, groups, connections] = await Promise.all([
        repo.listAccounts(context.workspace.id),
        repo.listScopes(context.workspace.id),
        repo.listGroups(context.workspace.id),
        repo.listConnections(context.workspace.id),
      ]);

      return {
        workspace: context.workspace,
        role: context.role,
        roleLabel: ROLE_LABEL[context.role],
        permissions: context.permissions,
        accounts,
        scopes,
        groups,
        connections,
        preferences,
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** Resolves a staged multi-account selection into one opaque scope id. */
  app.post<{ Params: { slug: string }; Body: { accountIds?: string[]; label?: string; save?: boolean } }>(
    '/api/workspaces/:slug/scopes/resolve',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
        const accountIds = request.body?.accountIds ?? [];
        if (accountIds.length === 0) throw invalid('Choose at least one account.', 'accountIds');

        const available = await repo.listAccounts(context.workspace.id);
        const known = new Set(available.map((account) => account.id));
        const unknown = accountIds.filter((id) => !known.has(id));
        if (unknown.length) throw invalid('One of those accounts is not in this workspace.', 'accountIds');

        const chosen = available.filter((account) => accountIds.includes(account.id));
        const currencies = new Set(chosen.map((account) => account.currency));
        const zones = new Set(chosen.map((account) => account.timeZone));

        // The frontend may preflight, but this is the authority on whether a
        // set of accounts can be blended into one total.
        const compatibility =
          currencies.size > 1 || zones.size > 1
            ? {
                state: 'separated' as const,
                reasons: [
                  ...(currencies.size > 1
                    ? [`Mixed reporting currencies: ${[...currencies].join(', ')}.`]
                    : []),
                  ...(zones.size > 1 ? [`Mixed reporting days: ${[...zones].join(', ')}.`] : []),
                ],
              }
            : { state: 'compatible' as const };

        const label =
          request.body?.label?.trim() ||
          (chosen.length === 1
            ? chosen[0].name
            : `${[...new Set(chosen.map((a) => (a.provider === 'google_ads' ? 'Google' : 'Meta')))].join(' + ')} · ${chosen.length} accounts`);

        const scope = {
          id: `scp_${randomUUID().slice(0, 8)}`,
          kind: 'selection' as const,
          label,
          accountIds,
        };
        await repo.upsertScope(context.workspace.id, scope);

        if (request.body?.save) {
          context.require('scopes.manage');
          await repo.upsertGroup(context.workspace.id, {
            id: `grp_${randomUUID().slice(0, 8)}`,
            label,
            accountIds,
            createdBy: context.user.name,
          });
        }

        return { scope, compatibility };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.delete<{ Params: { slug: string; groupId: string } }>(
    '/api/workspaces/:slug/groups/:groupId',
    async (request, reply) => {
      try {
        requireCsrf(request);
        await requireWorkspace(request, request.params.slug, 'scopes.manage');
        await repo.deleteGroup(request.params.groupId);
        return { deleted: true };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/members', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'members.read');
      const members = await repo.listMembers(context.workspace.id);
      return {
        members,
        canManage: context.can('members.manage'),
        assignableRoles: assignableRoles(context.role),
        roleMatrix: (['owner', 'admin', 'analyst', 'viewer'] as Role[]).map((role) => ({
          role,
          label: ROLE_LABEL[role],
          permissions: permissionsForRole(role),
        })),
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch<{ Params: { slug: string; memberId: string }; Body: { role?: Role } }>(
    '/api/workspaces/:slug/members/:memberId',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'members.manage');
        const role = request.body?.role;
        if (!role) throw invalid('Choose a role.', 'role');
        if (!assignableRoles(context.role).includes(role)) {
          throw invalid(`Your role cannot assign ${ROLE_LABEL[role]}.`, 'role');
        }

        const target = await repo.getUser(request.params.memberId);
        if (!target) throw notFound('That member is not in this workspace.');

        await repo.setMembership(target.id, context.workspace.id, role);
        await repo.recordAudit(context.workspace.id, {
          id: `aud_${randomUUID().slice(0, 8)}`,
          at: new Date().toISOString(),
          actor: context.user.name,
          action: 'changed a member role',
          target: target.email,
          context: `${ROLE_LABEL[role]} in ${context.workspace.name}`,
        });

        return { members: await repo.listMembers(context.workspace.id) };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.delete<{ Params: { slug: string; memberId: string } }>(
    '/api/workspaces/:slug/members/:memberId',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'members.manage');
        if (request.params.memberId === context.user.id) {
          throw invalid('You cannot remove your own access.');
        }
        await repo.removeMembership(request.params.memberId, context.workspace.id);
        return { members: await repo.listMembers(context.workspace.id) };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/audit', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'audit.read');
      return { entries: await repo.listAudit(context.workspace.id) };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
