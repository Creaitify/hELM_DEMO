/**
 * Backend topology.
 *
 * The browser always calls same-origin /api. Next rewrites that to the private
 * API origin, so the session cookie belongs to the public origin and the
 * backend is never addressed directly from a page.
 *
 * Server Components bypass the rewrite and call the API origin directly,
 * forwarding the incoming cookie, because a server-side fetch to its own
 * origin would be a needless extra hop.
 */

export const API_ORIGIN = process.env.HELM_API_ORIGIN ?? 'http://localhost:8100';

/** mock keeps the app entirely on the typed fixtures with no backend running. */
export const DATA_MODE = (process.env.HELM_DATA_MODE ?? 'live') as 'live' | 'mock';

export const isLive = DATA_MODE === 'live';

/** Same-origin path used from the browser. */
export function apiPath(path: string): string {
  return path.startsWith('/api') ? path : `/api${path}`;
}

/** Absolute URL used from a Server Component. */
export function apiUrl(path: string): string {
  return `${API_ORIGIN}${apiPath(path)}`;
}
