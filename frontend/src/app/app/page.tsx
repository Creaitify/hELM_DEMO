import { redirect } from 'next/navigation';
import { WORKSPACE_SLUG } from '@/services/mock';
import { routes } from '@/lib/routes';

/**
 * Convenience entry.
 *
 * This used to resolve the signed-in member's workspaces on the server and
 * land on the first one. A static export has no server to resolve anything on
 * and no session to resolve — and an unconditional `redirect()` at build time
 * is not something an exported page can express — so it sends everyone to the
 * sample workspace, which is the only one the exported site contains.
 *
 * The server-side version belongs here again the moment this is deployed
 * somewhere with a running Next server; see git history for it.
 */
export default function AppEntry() {
  redirect(routes.briefing(WORKSPACE_SLUG));
}
