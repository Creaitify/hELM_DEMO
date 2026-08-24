import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shell/AppShell';
import { ConnectionLedger } from '@/features/connections/ConnectionLedger';
import { IconChevronLeft } from '@/components/icons';
import { routes } from '@/lib/routes';
import { NOW_ISO, accounts, connections, connectors } from '@/services/mock';

export const metadata: Metadata = { title: 'Connections' };

export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <PageShell
      title="Connections"
      context={
        <p className="mono text-[12px] text-ink-400">
          Read-only access to Google Ads and Meta Ads reporting for Northstar Group
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

      <ConnectionLedger
        connections={connections}
        connectors={connectors}
        accounts={accounts}
        nowIso={NOW_ISO}
      />
    </PageShell>
  );
}
