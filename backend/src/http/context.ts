import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';
import { openSession, readSessionToken, type SessionPayload } from '../auth/session.js';
import { denialReason, permissionsForRole, roleCan, type Permission } from '../auth/rbac.js';
import * as repo from '../graph/repository.js';
import type { HelmErrorCode, Role, SessionUser, Workspace } from '../domain/types.js';

/**
 * Request context and guards.
 *
 * Authorization is resolved here on every request from the session cookie and
 * the workspace membership edge in the graph. Nothing downstream is allowed to
 * trust a role, a workspace id, or a permission that did not come through one
 * of these guards.
 */

export class HelmHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: HelmErrorCode,
    message: string,
    readonly retryable = false,
    readonly field?: string,
  ) {
    super(message);
  }

  toBody() {
    return {
      error: { code: this.code, message: this.message, retryable: this.retryable, field: this.field },
    };
  }
}

export function unauthenticated(message = 'Sign in to continue.') {
  return new HelmHttpError(401, 'unauthenticated', message);
}

export function forbidden(message: string) {
  return new HelmHttpError(403, 'unauthorized', message);
}

export function notFound(message: string) {
  return new HelmHttpError(404, 'not_found', message);
}

export function invalid(message: string, field?: string) {
  return new HelmHttpError(400, 'validation', message, false, field);
}

/**
 * Resolves who is asking.
 *
 * With AUTH_ENABLED=false there is no sign-in step at all: every request
 * carries the sample owner, so the product is demonstrable without a consent
 * screen. The membership lookup and every database write are unchanged — only
 * the question of who the person is has been answered in advance.
 */
export function session(request: FastifyRequest): SessionPayload | null {
  if (!env.auth.enabled) return openSession();
  const raw = request.cookies?.[env.session.cookieName];
  return readSessionToken(raw);
}

export function requireSession(request: FastifyRequest): SessionPayload {
  const payload = session(request);
  if (!payload) throw unauthenticated();
  return payload;
}

export type WorkspaceContext = {
  user: SessionUser;
  csrf: string;
  workspace: Workspace;
  role: Role;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  /** Throws a 403 with plain-language copy when the role lacks the permission. */
  require: (permission: Permission) => void;
};

export async function requireWorkspace(
  request: FastifyRequest,
  slug: string,
  permission?: Permission,
): Promise<WorkspaceContext> {
  const payload = requireSession(request);
  const stored = await repo.getWorkspaceBySlug(slug);
  if (!stored) throw notFound('That workspace does not exist, or you do not have access to it.');

  const role = await repo.membershipRole(payload.user.id, stored.id);
  if (!role) throw notFound('That workspace does not exist, or you do not have access to it.');

  const permissions = permissionsForRole(role);
  const context: WorkspaceContext = {
    user: payload.user,
    csrf: payload.csrf,
    workspace: { ...stored, role },
    role,
    permissions,
    can: (needed) => roleCan(role, needed),
    require: (needed) => {
      if (!roleCan(role, needed)) throw forbidden(denialReason(needed));
    },
  };

  if (permission) context.require(permission);
  return context;
}

/**
 * Double-submit CSRF for mutating requests.
 *
 * The session cookie carries a per-session token; the client echoes it in a
 * header. A cross-site form post cannot read the cookie, so it cannot echo it.
 */
export function requireCsrf(request: FastifyRequest) {
  const payload = requireSession(request);
  // There is no session cookie to forge when auth is off, so the double-submit
  // check has nothing to protect.
  if (!env.auth.enabled) return payload;
  const header = request.headers['x-helm-csrf'];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided || provided !== payload.csrf) {
    throw new HelmHttpError(403, 'unauthorized', 'This request could not be verified. Reload and try again.');
  }
  return payload;
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof HelmHttpError) {
    return reply.status(error.status).send(error.toBody());
  }
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  request_log(error);
  return reply.status(500).send({
    error: { code: 'service_unavailable', message, retryable: true },
  });
}

function request_log(error: unknown) {
  if (!env.isProduction) console.error(error);
}
