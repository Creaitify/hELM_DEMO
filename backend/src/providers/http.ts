import { env } from '../env.js';

/**
 * Outbound HTTP with a deadline.
 *
 * Node's `fetch` has no default timeout. A connection that opens and then goes
 * quiet — a provider having a bad day, a network path that blackholes rather
 * than resets — leaves the promise pending forever. Every call here is made
 * either inside an HTTP request or inside a fleet run, so "forever" means a
 * request that never answers or a run parked mid-step with no way out.
 *
 * The timeout is a ceiling, not a target. It is deliberately generous: the
 * point is to guarantee the call ends, not to be strict about how fast a
 * provider ought to be.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = env.http.timeoutMs,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    // An abort is this timeout firing, not the provider refusing. Saying so
    // is the difference between "they are down" and "we gave up waiting".
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request to ${new URL(url).host} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
