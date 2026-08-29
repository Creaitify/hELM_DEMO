import * as repo from '../graph/repository.js';
import { buildEvidencePack } from '../agents/evidence-pack.js';
import { repairFindingFigures } from '../agents/orchestrator.js';
import * as sample from '../sample/constants.js';
import type { DataBasis } from '../domain/types.js';

/**
 * Recomputes the figures on findings that were stored without them.
 *
 * The analyst used to leave `metricHighlights` empty and ask the model to size
 * the financial exposure itself. The model could not express minor units — a
 * campaign carrying 7,64,000 came back as 7,640 of exposure, a hundredfold
 * error stated with full confidence — and it returned the same figure for the
 * low and the high, so the card showed a range that was not a range above a
 * metric strip that was not there.
 *
 * The analyst derives both from the evidence pack now. This brings the
 * findings already in the graph up to the same standard using the same
 * arithmetic, so a workspace does not end up with two kinds of finding card
 * depending on when the finding happened to be written.
 *
 * It runs at boot, it is idempotent, and it says nothing when there is nothing
 * to do. The workspaces come from the same list the seed writes, because those
 * are the only ones the graph is guaranteed to hold.
 */
export async function repairStoredFindings(log: (message: string) => void): Promise<void> {
  let scanned = 0;
  let repaired = 0;

  for (const entry of sample.workspaces) {
    const workspace = await repo.getWorkspaceBySlug(entry.slug);
    if (!workspace) continue;

    const [accounts, campaigns, creatives, scopes] = await Promise.all([
      repo.listAccounts(workspace.id),
      repo.listCampaigns(workspace.id),
      repo.listCreatives(workspace.id),
      repo.listScopes(workspace.id),
    ]);
    if (campaigns.length === 0) continue;

    const scope = scopes.find((candidate) => candidate.id === sample.DEFAULT_SCOPE_ID) ?? scopes[0];
    const inScope = scope ? accounts.filter((account) => scope.accountIds.includes(account.id)) : accounts;
    const usable = inScope.length ? inScope : accounts;

    // The pack needs only enough basis to name the window it was folded over.
    // Neither derivation reads the comparison dates.
    const basis: DataBasis = {
      accountIds: usable.map((account) => account.id),
      startDateInclusive: sample.WINDOW_START,
      endDateInclusive: sample.WINDOW_END,
      comparisonStartDateInclusive: sample.COMPARE_START,
      comparisonEndDateInclusive: sample.COMPARE_END,
      completeThroughDate: sample.WINDOW_END,
      accountBasis: [],
      aggregation: { state: 'compatible' },
      exclusions: [],
    };

    const pack = buildEvidencePack({
      scopeLabel: scope?.label ?? 'All accounts',
      rangeLabel: sample.WINDOW_LABEL,
      currency: usable[0]?.currency ?? workspace.defaultCurrency,
      accounts: usable,
      campaigns: campaigns.filter((campaign) =>
        usable.some((account) => account.id === campaign.accountId),
      ),
      creatives,
      basis,
      focusCampaignIds: [],
    });

    const result = await repairFindingFigures(workspace.id, pack);
    scanned += result.scanned;
    repaired += result.repaired;
  }

  if (repaired > 0) log(`repaired ${repaired} of ${scanned} stored findings`);
}
