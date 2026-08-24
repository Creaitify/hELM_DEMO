import { redirect } from 'next/navigation';
import { WORKSPACE_SLUG, workspaces } from '@/services/mock';

/** Convenience entry: resolve to the last valid workspace, or onboarding. */
export default function AppEntry() {
  if (workspaces.length === 0) redirect('/onboarding');
  redirect(`/w/${WORKSPACE_SLUG}`);
}
