'use client';

import type { HelmError } from '@/contracts';

/**
 * Browser mutations.
 *
 * Every call is same-origin and credentialed, so the HttpOnly session cookie
 * travels and nothing has to be held in browser storage. Mutating requests
 * echo the session's CSRF token in a header — a cross-site form post cannot
 * read the cookie, so it cannot echo the value.
 */

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

async function ensureCsrf(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  try {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
    const body = (await response.json()) as { csrfToken?: string };
    csrfToken = body.csrfToken ?? null;
  } catch {
    csrfToken = null;
  }
  return csrfToken;
}

export class ApiError extends Error {
  constructor(
    readonly helm: HelmError,
    readonly status: number,
  ) {
    super(helm.message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';

  if (method !== 'GET') {
    const token = await ensureCsrf();
    if (token) headers['x-helm-csrf'] = token;
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const parsed = (await response.json().catch(() => null)) as (T & { error?: HelmError }) | null;

  if (!response.ok) {
    throw new ApiError(
      parsed?.error ?? {
        code: 'service_unavailable',
        message: `The request failed (${response.status}).`,
        retryable: response.status >= 500,
      },
      response.status,
    );
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** Plain-language message for a caught error, safe to show a user. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.helm.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Try again.';
}
