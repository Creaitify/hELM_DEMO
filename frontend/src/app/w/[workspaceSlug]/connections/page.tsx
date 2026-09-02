import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shell/AppShell';
import { InlineNotice } from '@/components/primitives/States';
import { ConnectionLedger } from '@/features/connections/ConnectionLedger';
import { fleetNotice } from '@/features/intelligence/fleet-fallback';
import { IconChevronLeft } from '@/components/icons';
import { routes } from '@/lib/routes';
import { getConnections } from '@/services/http/queries';
import {
  NOW_ISO,
  accounts as sampleAccounts,
  connections as sampleConnections,
  connectors as sampleConnectors,
} from '@/services/mock';

export const metadata: Metadata = { title: 'Connections' };

export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  // The OAuth callback params have no meaning in a static export.
  const connection = undefined;
  const status = undefined;

  const live = await getConnections(workspaceSlug);
  const offline = fleetNotice(live.ok, live.ok ? undefined : live.error);

  const connections = live.ok ? live.data.connections : sampleConnections;
  const accounts = live.ok ? live.data.accounts : sampleAccounts;
  const connectors = live.ok ? live.data.connectors : sampleConnectors;

  return (
    <PageShell
      title="Connections"
      context={
        <p className="mono text-[12px] text-ink-400">
          Read-only access to Google Ads and Meta Ads reporting for this workspace
        </p>
      }
    >
      <Link
        href={routes.briefing(workspaceSlug)}
        className="mb-5 inline-flex items-center gap-1 text-[13.5px] text-ink-500 transition-colors hover:text-ink-950"
      >
        <IconChevronLeft size={16} />
        Back to Briefing
      </Link>

      {offline ? (
        <InlineNotice tone="warn" title={offline.title} className="mb-6">
          {offline.body}
        </InlineNotice>
      ) : null}

      <ConnectionLedger
        connections={connections}
        connectors={connectors}
        accounts={accounts}
        nowIso={NOW_ISO}
        workspaceSlug={workspaceSlug}
        canManage={live.ok ? live.data.canManage : false}
        canDeleteData={live.ok ? live.data.canDeleteData : false}
        providerConfiguration={live.ok ? live.data.providerConfiguration : undefined}
        live={live.ok}
        callbackProvider={connection}
        callbackStatus={status}
      />
    </PageShell>
  );
}
