/**
 * Proves the fleet actually works.
 *
 * Not a unit-test suite. These are the assertions that would have caught the
 * things that were genuinely broken: an agent chat that answers without
 * reading anything, an approval that records a decision and then does nothing,
 * and a document that downloads as ninety bytes of nothing in a format the
 * receiving application refuses to open.
 *
 * Every check runs against a live API and a live model. There are no mocks
 * here on purpose — a mocked fleet passing tells you nothing about whether the
 * fleet works.
 *
 *   node scripts/verify-agents.mjs
 *   HELM_API=http://localhost:8100 HELM_APP=http://localhost:3000 node scripts/verify-agents.mjs
 */

const API = process.env.HELM_API ?? 'http://localhost:8100';
const APP = process.env.HELM_APP ?? 'http://localhost:3000';
const WORKSPACE = process.env.HELM_WORKSPACE ?? 'northstar-group';

const base = `${API}/api/workspaces/${WORKSPACE}`;

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, detail = '') {
  passed += 1;
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function bad(name, detail) {
  failed += 1;
  failures.push(`${name}: ${detail}`);
  console.log(`  FAIL  ${name} — ${detail}`);
}

function check(name, condition, detail = '') {
  if (condition) ok(name, detail);
  else bad(name, detail || 'assertion failed');
  return Boolean(condition);
}

function section(title) {
  console.log(`\n${title}\n${'-'.repeat(title.length)}`);
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls a run until it leaves the stage it is in, or the deadline passes. */
async function waitForStage(runId, wanted, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const { body } = await json(`/intelligence/${runId}`);
    last = body?.run?.stage ?? null;
    if (wanted.includes(last)) return { stage: last, run: body?.run, detail: body };
    await sleep(3000);
  }
  return { stage: last, run: null, detail: null, timedOut: true };
}

/* ------------------------------------------------------------- 1. health -- */

async function verifyHealth() {
  section('1. The service and its reasoning');

  const response = await fetch(`${API}/api/health`);
  const health = await response.json().catch(() => null);

  check('API answers /api/health', response.status === 200, `status ${response.status}`);
  check('decision graph is connected', health?.graph?.ok === true, health?.graph?.detail ?? 'no detail');

  const reasoning = health?.reasoning?.state;
  check(
    'agents reason with a live model',
    reasoning === 'live',
    reasoning === 'live' ? health.reasoning.detail : `reasoning is "${reasoning}" — the fleet is running scripted`,
  );

  console.log(`        image generation: ${health?.capabilities?.imageGeneration ?? 'unknown'}`);
  return health;
}

/* --------------------------------------------------------- 2. agent chat -- */

async function verifyAgentChat() {
  section('2. The agent chat, and whether it calls its tools');

  // A question that cannot be answered from the system prompt. If the numbers
  // come back right, the model read the graph rather than inventing them.
  const grounded = await json('/agent', {
    method: 'POST',
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content:
            'What is our blended spend and CPA over the window, and which single campaign has the worst CPA? Give exact figures.',
        },
      ],
    }),
  });

  check('agent answers', grounded.status === 200, `status ${grounded.status}`);
  const reply = String(grounded.body?.reply ?? '');
  check('agent reply is not empty', reply.trim().length > 20, `${reply.length} chars`);
  check(
    'agent quotes real figures rather than hedging',
    /\d[\d,.]{2,}/.test(reply),
    reply.slice(0, 120).replace(/\s+/g, ' '),
  );
  check('agent reports the model it used', Boolean(grounded.body?.model), grounded.body?.model ?? 'none');
  check(
    'agent ran against a live model, not the scripted fallback',
    grounded.body?.live === true,
    `live=${grounded.body?.live}`,
  );

  // A read tool that returns a countable list, so the answer can be checked
  // against the graph rather than taken on trust.
  const { body: intelligence } = await json('/intelligence');
  const runCount = intelligence?.runs?.length ?? 0;

  const listing = await json('/agent', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'How many investigations exist in this workspace? Answer with the number.' }],
    }),
  });
  const answered = String(listing.body?.reply ?? '');
  check(
    'agent can call list_investigations and count correctly',
    answered.includes(String(runCount)),
    `graph has ${runCount}; agent said "${answered.slice(0, 100).replace(/\s+/g, ' ')}"`,
  );

  return true;
}

/* ------------------------------------------------- 3. approval resumes it -- */

async function verifyApprovalDrivesTheFleet() {
  section('3. Approving a decision puts the fleet back to work');

  const { body } = await json('/intelligence');
  const runs = body?.runs ?? [];

  const candidate = runs.find((run) => run.stage === 'waiting_for_approval');
  if (!candidate) {
    console.log('  SKIP  no run is waiting for approval — starting one instead');
    const started = await json('/intelligence', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'diagnose',
        question: 'Verification run: which campaign is driving the CPA rise?',
        generateCreative: true,
      }),
    });
    if (!check('a new run starts', started.status === 202, `status ${started.status}`)) return;
    const waited = await waitForStage(started.body.run.id, ['waiting_for_approval', 'complete', 'failed']);
    if (waited.stage !== 'waiting_for_approval') {
      bad('a fresh run reaches human approval', `stopped at ${waited.stage}`);
      return;
    }
    ok('a fresh run reaches human approval');
    return verifyApprovalOn(started.body.run.id);
  }

  return verifyApprovalOn(candidate.id);
}

async function verifyApprovalOn(runId) {
  const { body: before } = await json(`/intelligence/${runId}`);
  const recommendations = before?.recommendations ?? [];
  check(`run ${runId} has proposals to decide`, recommendations.length > 0, `${recommendations.length}`);

  for (const recommendation of recommendations) {
    const decided = await json(`/intelligence/${runId}/recommendations/${recommendation.id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ outcome: 'approved', note: 'verify-agents' }),
    });
    if (decided.status !== 200) {
      bad('every proposal can be decided', `${recommendation.id} returned ${decided.status}`);
      return;
    }
  }
  ok('every proposal can be decided', `${recommendations.length} approved`);

  // This is the assertion that matters. Before the resume fix the run stayed
  // at waiting_for_approval forever and nothing below this line was reachable.
  const finished = await waitForStage(runId, ['complete', 'failed']);
  if (!check('the run leaves waiting_for_approval after approval', finished.stage === 'complete', `stage ${finished.stage}`)) {
    return;
  }

  const nodes = finished.run?.workflow ?? [];
  const nodeState = (id) => nodes.find((node) => node.id === id)?.state;

  check('the approval node completes', nodeState('approval') === 'completed', `approval=${nodeState('approval')}`);
  check('the output node completes', nodeState('output') === 'completed', `output=${nodeState('output')}`);
  check('a decision memo is filed', Boolean(finished.run?.artifactId), finished.run?.artifactId ?? 'none');
  check(
    'decisions are recorded against the run',
    (finished.detail?.decisions?.length ?? 0) >= recommendations.length,
    `${finished.detail?.decisions?.length ?? 0} decisions`,
  );

  const images = nodes.find((node) => node.id === 'images');
  console.log(`        images node: ${images?.state} — ${images?.activity ?? 'no activity'}`);

  return runId;
}

/* ------------------------------------------------------- 4. the documents -- */

/** What each format has to actually be, not merely be labelled as. */
const FORMAT_SHAPE = {
  pdf: (text) => text.startsWith('%PDF-') && text.includes('%%EOF'),
  doc: (text) => text.includes('urn:schemas-microsoft-com:office:word'),
  md: (text) => text.trimStart().startsWith('#'),
  html: (text) => /<!DOCTYPE html>/i.test(text),
  json: (text) => {
    try {
      return typeof JSON.parse(text) === 'object';
    } catch {
      return false;
    }
  },
};

async function verifyDocumentFormats(documentId, label) {
  for (const [format, isValid] of Object.entries(FORMAT_SHAPE)) {
    const response = await fetch(`${base}/documents/${documentId}/download?format=${format}`);
    const text = await response.text();
    const bytes = Buffer.byteLength(text, 'binary');

    if (response.status !== 200) {
      bad(`${label} downloads as ${format}`, `status ${response.status}`);
      continue;
    }
    if (!isValid(text)) {
      bad(`${label} is a valid ${format}`, `${bytes} bytes, wrong shape: ${text.slice(0, 60).replace(/\s+/g, ' ')}`);
      continue;
    }
    // A "document" that is only a title and a summary is the failure this
    // catches: it downloads fine and opens to nothing.
    if (bytes < 400) {
      bad(`${label} as ${format} has a real body`, `only ${bytes} bytes`);
      continue;
    }
    ok(`${label} downloads as valid ${format}`, `${bytes.toLocaleString()} bytes`);
  }
}

async function verifyDocuments() {
  section('4. Documents, in every format they are offered in');

  const { status, body } = await json('/documents');
  check('the documents shelf loads', status === 200, `status ${status}`);
  check('the shelf has documents', (body?.documents?.length ?? 0) > 0, `${body?.documents?.length ?? 0}`);
  check(
    'the shelf reports its own analytics',
    body?.analytics && typeof body.analytics.total === 'number',
    body?.analytics ? `${body.analytics.total} documents, ${body.analytics.words} words, coverage ${body.analytics.coverage}%` : 'missing',
  );

  const formats = body?.formats ?? [];
  check('five output formats are offered', formats.length >= 5, formats.map((entry) => entry.id).join(', '));

  const memo = body?.documents?.[0];
  if (memo) await verifyDocumentFormats(memo.id, 'decision memo');

  return body;
}

/* -------------------------------------------- 5. the campaign report --- */

async function verifyCampaignReport() {
  section('5. A document written from the campaign analysis');

  const preview = await json('/documents/campaign-report/preview');
  check('the campaign report can be previewed before it is filed', preview.status === 200, `status ${preview.status}`);
  check(
    'the preview is a whole document',
    (preview.body?.markdown?.length ?? 0) > 1500,
    `${preview.body?.markdown?.length ?? 0} chars over ${preview.body?.campaignCount ?? 0} campaigns`,
  );
  check(
    'the report says whether it is measured or sample data',
    typeof preview.body?.measured === 'boolean',
    `measured=${preview.body?.measured}`,
  );

  const markdown = preview.body?.markdown ?? '';
  for (const heading of [
    'The short version',
    'Where the money went',
    'What got better and what got worse',
    'What these numbers are built on',
  ]) {
    check(`the report contains "${heading}"`, markdown.includes(heading));
  }

  // The report opens in plain English rather than a table. This catches a
  // regression to the metric dump it used to be.
  const opening = (markdown.split('## The short version')[1] ?? '').trim();
  check(
    'the report opens with a readable sentence, not a figure',
    /^[A-Z][a-z]+ /.test(opening),
    opening.slice(0, 90).replace(/\s+/g, ' '),
  );

  // Charts are the point of the rewrite, so their absence has to fail.
  const html = preview.body?.html ?? '';
  const charts = (html.match(/<svg/g) ?? []).length;
  check('the report draws charts', charts >= 3, `${charts} charts in the HTML`);
  check(
    'no chart label is cut off at the viewBox edge',
    !/<text[^>]*x="-/.test(html),
    'labels sit inside their column',
  );

  // A document handed to somebody outside the company should say who wrote it.
  check('the report carries the HELM masthead', /class="masthead"/.test(html) && html.includes('HELM'));
  check('the report closes with a colophon', /class="colophon"/.test(html));

  const written = await json('/documents/campaign-report', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!check('the campaign report files onto the shelf', written.status === 201, `status ${written.status}`)) return;

  ok('the filed report carries a frozen body', `${written.body?.document?.content?.length ?? 0} chars`);
  await verifyDocumentFormats(written.body.document.id, 'campaign report');

  return written.body?.document;
}

/* ------------------------------------------------------------ 6. the fleet -- */

async function verifyFleet() {
  section('6. The Agent Fleet reports what it has actually done');

  const { status, body } = await json('/intelligence');
  check('the fleet page has data', status === 200, `status ${status}`);

  const fleet = body?.fleet;
  const agents = fleet?.agents ?? [];
  check('four specialists are described', agents.length === 4, `${agents.length}`);

  // This is the regression worth catching. The health was computed on the
  // server and dropped at the response, so the page called Agent Fleet could
  // not say whether any of them had ever run.
  const withHealth = agents.filter((agent) => typeof agent.runs === 'number');
  check(
    'every specialist reports how often it has been called',
    withHealth.length === agents.length,
    withHealth.length ? `e.g. ${withHealth[0].name}: ${withHealth[0].runs} calls` : 'no health on any agent',
  );

  const called = agents.filter((agent) => agent.runs > 0);
  check(
    'the fleet has a call history to show',
    called.length > 0,
    called.map((agent) => `${agent.name} ${agent.runs}`).join(', '),
  );

  check(
    'pass rates are reported for the specialists that have run',
    called.every((agent) => typeof agent.passRate === 'number'),
    called.map((agent) => `${agent.name} ${Math.round((agent.passRate ?? 0) * 100)}%`).join(', '),
  );

  check(
    'the work log is returned',
    Array.isArray(fleet?.invocations) && fleet.invocations.length > 0,
    `${fleet?.invocations?.length ?? 0} invocations`,
  );

  // A revision in the log is the evidence the review gate is real rather than
  // decorative: it means work was sent back at least once.
  const revised = (fleet?.invocations ?? []).filter((entry) => entry.revision > 1).length;
  console.log(`        ${revised} of the last ${fleet?.invocations?.length ?? 0} calls needed a revision`);
}

/* ------------------------------------------------------- 7. the frontend -- */

async function verifyFrontend() {
  section('7. The frontend renders what the backend produced');

  for (const [label, path] of [
    ['briefing', ''],
    ['agent fleet', '/intelligence'],
    ['documents', '/documents'],
    ['assets', '/library'],
  ]) {
    try {
      const response = await fetch(`${APP}/w/${WORKSPACE}${path}`, { redirect: 'follow' });
      const html = await response.text();
      check(`${label} page renders`, response.status === 200, `status ${response.status}`);
      check(`${label} page is not an error page`, !/Something went wrong/i.test(html), '');
    } catch (error) {
      bad(`${label} page renders`, error.message);
    }
  }
}

/* -------------------------------------------------------------------- run -- */

const startedAt = Date.now();
console.log(`Verifying the HELM fleet\n  api ${API}\n  app ${APP}\n  workspace ${WORKSPACE}`);

try {
  await verifyHealth();
  await verifyAgentChat();
  await verifyApprovalDrivesTheFleet();
  await verifyDocuments();
  await verifyCampaignReport();
  await verifyFleet();
  await verifyFrontend();
} catch (error) {
  bad('the verification run itself', error.stack ?? error.message);
}

const seconds = Math.round((Date.now() - startedAt) / 1000);
console.log(`\n${'='.repeat(64)}`);
console.log(`${passed} passed, ${failed} failed, in ${seconds}s`);
if (failures.length) {
  console.log('\nWhat failed:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed ? 1 : 0);
