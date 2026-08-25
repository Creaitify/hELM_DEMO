import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';
import type { SessionUser } from '../domain/types.js';

/**
 * Stateless signed sessions.
 *
 * The cookie carries an HMAC-signed payload only. Provider access and refresh
 * tokens are never placed in it — those stay in the graph store, server side,
 * and are never returned to the browser.
 */

export type SessionPayload = {
  user: SessionUser;
  /** Issued-at, seconds. */
  iat: number;
  /** Expiry, seconds. */
  exp: number;
  /** Rotating value used for CSRF double-submit on mutating requests. */
  csrf: string;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded + '='.repeat((4 - (padded.length % 4)) % 4), 'base64');
}

function sign(body: string): string {
  return base64url(createHmac('sha256', env.session.secret).update(body).digest());
}

export function createSessionToken(user: SessionUser): { token: string; payload: SessionPayload } {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    user,
    iat: now,
    exp: now + env.session.ttlSeconds,
    csrf: randomBytes(16).toString('hex'),
  };
  const body = base64url(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, payload };
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(body);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromBase64url(body).toString('utf8')) as SessionPayload;
    if (!payload?.user?.id) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * The identity every request carries while AUTH_ENABLED is false.
 *
 * It is a real session payload with a stable id, so membership, audit entries
 * and run authorship all still resolve against the database exactly as they
 * would for a signed-in person.
 */
export function openSession(): SessionPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    user: {
      id: process.env.HELM_OPEN_USER_ID || 'usr_aniket',
      name: process.env.HELM_OPEN_USER_NAME || 'Aniket Rao',
      email: (process.env.HELM_OPEN_USER_EMAIL || 'aniket@northstargroup.in').toLowerCase(),
      title: 'Performance lead',
      identityProvider: 'demo',
    },
    iat: now,
    exp: now + env.session.ttlSeconds,
    csrf: 'open',
  };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: env.session.sameSite,
  secure: env.session.secure,
  path: '/',
  maxAge: env.session.ttlSeconds,
  domain: env.session.domain,
} as const;

/**
 * Only same-site relative paths are accepted as a post-auth destination.
 * An absolute URL, a protocol-relative URL, or a backslash trick is rejected.
 */
export function safeReturnTo(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (value.includes('://')) return fallback;
  return value;
}

/** Short-lived signed state for a provider OAuth round trip. */
export function createOAuthState(data: Record<string, string>): string {
  const body = base64url(JSON.stringify({ ...data, n: randomBytes(8).toString('hex'), t: Date.now() }));
  return `${body}.${sign(body)}`;
}

export function readOAuthState(state: string | undefined, maxAgeMs = 10 * 60 * 1000): Record<string, string> | null {
  if (!state) return null;
  const dot = state.lastIndexOf('.');
  if (dot < 1) return null;
  const body = state.slice(0, dot);
  const signature = state.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(fromBase64url(body).toString('utf8')) as Record<string, string> & { t: number };
    if (Date.now() - Number(parsed.t) > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}
