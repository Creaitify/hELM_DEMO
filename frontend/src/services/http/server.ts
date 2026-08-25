import 'server-only';
import { cookies } from 'next/headers';
import { apiUrl, isLive } from './config';
import type { HelmError } from '@/contracts';

/**
 * Server-side API reads.
 *
 * Protected Server Components resolve the session by forwarding the incoming
 * cookie to the private API. The backend remains authoritative for session,
 * membership, permission and workspace resolution; this layer only carries the
 * cookie and parses the response.
 *
 * A failed read never throws into a page render. It returns a typed failure so
 * the route can show its own error state instead of a stack trace.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: HelmError; status: number };

export async function apiGet<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  if (!isLive) {
    return {
      ok: false,
      status: 0,
      error: { code: 'service_unavailable', message: 'Running on fixtures — HELM_DATA_MODE is mock.', retryable: false },
    };
  }

  try {
    const jar = await cookies();
    const cookieHeader = jar
      .getAll()
      .map((entry) => `${entry.name}=${entry.value}`)
      .join('; ');

    const response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    const body = (await response.json().catch(() => null)) as
      | (T & { error?: HelmError })
      | { error: HelmError }
      | null;

    if (!response.ok) {
      const error = (body as { error?: HelmError } | null)?.error ?? {
        code: 'service_unavailable' as const,
        message: `The request failed (${response.status}).`,
        retryable: response.status >= 500,
      };
      return { ok: false, error, status: response.status };
    }

    return { ok: true, data: body as T };
  } catch (cause) {
    return {
      ok: false,
      status: 0,
      error: {
        code: 'network_unavailable',
        message:
          cause instanceof Error && cause.message.includes('fetch')
            ? 'The HELM API is not reachable. Start the backend, or set HELM_DATA_MODE=mock.'
            : 'The HELM API is not reachable.',
        retryable: true,
      },
    };
  }
}

/** True when the caller has a session cookie at all — cheap pre-check. */
export async function hasSessionCookie(): Promise<boolean> {
  const jar = await cookies();
  const name = process.env.HELM_SESSION_COOKIE_NAME ?? 'helm_session';
  return Boolean(jar.get(name)?.value);
}
