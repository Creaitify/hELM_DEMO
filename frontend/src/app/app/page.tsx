import { redirect } from 'next/navigation';
import { getSession } from '@/services/http/queries';
import { routes } from '@/lib/routes';
import { WORKSPACE_SLUG } from '@/services/mock';

/**
 * Convenience entry.
 *
 * Resolves the signed-in member's workspaces on the server and lands on the
 * first one. No workspace means onboarding; no session means sign-in.
 */
export default async function AppEntry() {
  const session = await getSession();

  if (!session.ok) redirect(routes.briefing(WORKSPACE_SLUG));
  if (!session.data.authenticated) redirect(routes.signin(routes.appEntry()));

  const [workspace] = session.data.workspaces;
  if (!workspace) redirect(routes.onboarding());
  redirect(routes.briefing(workspace.slug));
}
