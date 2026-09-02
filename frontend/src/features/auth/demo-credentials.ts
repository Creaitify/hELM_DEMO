/**
 * The demo account.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  THIS IS NOT AUTHENTICATION. It is a form in front of a door that is
 *  already open, and it is worth being blunt about why.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The API offers exactly two ways in: Google OAuth, and `POST /api/auth/demo`,
 * which signs in the sample identity and needs no credentials at all. There is
 * no password endpoint, and adding one is backend work that was explicitly out
 * of scope.
 *
 * So the email and password below are compared in the browser, and on a match
 * the panel calls that same open demo endpoint. Anyone can read this file, or
 * skip the form entirely and call the endpoint themselves. The pair exists to
 * make the sign-in page demonstrable — something to type, a failure state to
 * show — not to keep anybody out.
 *
 * Before this deployment holds anything real: delete this file, and gate entry
 * on the API. A credential the client can check is not a credential.
 */

export const DEMO_EMAIL = 'demo@helm.app';
export const DEMO_PASSWORD = 'helm-demo-2026';

/** Case-insensitive on the email, exact on the password. */
export function matchesDemoCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}
