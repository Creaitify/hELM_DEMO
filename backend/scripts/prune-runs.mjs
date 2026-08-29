/**
 * Removes accumulated test runs from a workspace.
 *
 * Every verification pass, demo and manual investigation leaves a run behind,
 * and their findings all land on the briefing. After enough of them the page
 * shows six near-identical findings about one campaign and nothing else, which
 * is worse than showing three real ones — the reader cannot tell what to open
 * first, which is the whole job of that page.
 *
 * The seeded fixtures are kept. They are the varied set the product is meant
 * to demonstrate, they are recreated on every boot anyway, and they are the
 * only runs here that were authored rather than accumulated.
 *
 * Memos are deliberately not deleted. A document somebody was handed is a
 * record of what was said at the time and outlives the investigation.
 *
 *   node scripts/prune-runs.mjs            # show what would go
 *   node scripts/prune-runs.mjs --apply    # actually delete
 */

const API = process.env.HELM_API ?? 'http://localhost:8000';
const WORKSPACE = process.env.HELM_WORKSPACE ?? 'northstar-group';
const APPLY = process.argv.includes('--apply');

const base = `${API}/api/workspaces/${WORKSPACE}`;

/** The seeded fixtures, by the id prefix the seed gives them. */
const KEEP = /^run_08\d{2}_/;

const response = await fetch(`${base}/intelligence`);
if (!response.ok) {
  console.error(`Could not read the workspace: ${response.status}`);
  process.exit(1);
}

const { runs } = await response.json();
const keep = runs.filter((run) => KEEP.test(run.id));
const drop = runs.filter((run) => !KEEP.test(run.id));

console.log(`${runs.length} runs — keeping ${keep.length} seeded, dropping ${drop.length} accumulated\n`);

console.log('KEEP');
for (const run of keep) console.log(`  ${run.id.padEnd(20)} ${run.stage.padEnd(22)} ${run.title.slice(0, 54)}`);

console.log('\nDROP');
for (const run of drop) {
  console.log(
    `  ${run.id.padEnd(20)} ${run.stage.padEnd(22)} ${run.title.slice(0, 54)}` +
      `  (${run.findingIds.length} findings)`,
  );
}

if (!APPLY) {
  console.log('\nNothing deleted. Re-run with --apply to do it.');
  process.exit(0);
}

let deleted = 0;
for (const run of drop) {
  const result = await fetch(`${base}/intelligence/${run.id}`, { method: 'DELETE' });
  if (result.ok) {
    deleted += 1;
  } else {
    console.log(`  could not delete ${run.id}: ${result.status}`);
  }
}

console.log(`\ndeleted ${deleted} of ${drop.length}`);
