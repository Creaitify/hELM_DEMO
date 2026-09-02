import { ArcBottlePoster } from '@/components/brand/ArcBottlePoster';
import {
  GoogleAdsMark,
  IconArrowRight,
  IconCheck,
  IconEvidence,
  IconLock,
  IconScope,
  IconSearch,
  IconShield,
  MetaAdsMark,
  ProviderMark,
} from '@/components/icons';
import { cn } from '@/lib/cn';

function Kicker({ index, label }: { index: string; label: string }) {
  return (
    <p className="pub-eyebrow flex items-center gap-3">
      <span className="text-[#6F918F]">{index}</span>
      <span className="h-px w-8 bg-night-line" aria-hidden="true" />
      {label}
    </p>
  );
}

/* ============================================================
   Movement 01 — One money view
   Wide horizontal reconciliation diagram integrated into the page.
   ============================================================ */

export function MovementOneMoneyView() {
  return (
    <section id="product" className="relative border-t border-night-line px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-end">
          <div>
            <Kicker index="01" label="One money view" />
            <h2 className="pub-section-title mt-5 max-w-[18ch] text-night-ink">
              The platforms can disagree. Your decision still cannot.
            </h2>
          </div>
          <p className="text-[16px] leading-[26px] text-night-muted lg:pb-2">
            Both platforms are reporting honestly about different things. HELM keeps each provider-reported
            value inspectable and publishes one normalized decision view with the attribution basis on it.
          </p>
        </div>

        {/* Horizontal reconciliation */}
        <div className="mt-14 overflow-hidden rounded-editorial border border-night-line bg-night-900/55">
          <div className="grid divide-y divide-night-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)] lg:divide-x lg:divide-y-0">
            <ReconciliationColumn
              provider="google_ads"
              title="Google Ads reports"
              value="1,356"
              unit="conversions"
              rows={[
                ['Conversion action', 'Purchase — web (primary)'],
                ['Attribution', 'Data-driven, 30-day click'],
                ['Counts', 'Every conversion, including repeats'],
                ['Currency', 'INR · Asia/Kolkata day'],
              ]}
            />
            <ReconciliationColumn
              provider="meta_ads"
              title="Meta Ads reports"
              value="1,104"
              unit="purchases"
              rows={[
                ['Event', 'Purchase (pixel)'],
                ['Attribution', '7-day click, 1-day view'],
                ['Counts', 'Deduplicated per person'],
                ['Currency', 'INR · Asia/Kolkata day'],
              ]}
            />
            <div className="bg-night-800/60 p-6 lg:p-7">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-night-accent" aria-hidden="true" />
                <p className="mono text-[10.5px] uppercase tracking-[0.12em] text-[#6BB3AD]">
                  HELM decision view
                </p>
              </div>
              <p className="mt-4 text-[42px] font-semibold leading-none text-night-ink tnum">2,268</p>
              <p className="mt-2 text-[13px] text-night-muted">mapped purchases · 7-day click basis</p>
              <dl className="mono mt-6 space-y-2.5 border-t border-night-line pt-4 text-[11.5px]">
                {[
                  ['Basis', '7-day click, both providers'],
                  ['Mapped events', 'Google primary Purchase + Meta Purchase'],
                  ['View-through', 'Excluded from the mapped basis'],
                  ['Freshness', 'Complete through 23 Aug'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-night-faint">{label}</dt>
                    <dd className="text-right text-night-muted">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-night-line bg-night-950/50 px-6 py-4">
            {[
              'Provider-reported values remain inspectable',
              'Totals carry currency, timezone, attribution and freshness',
              'Incompatible data is separated, never blended',
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 text-[12.5px] text-night-muted">
                <span className="text-[#7BDCB5]">
                  <IconCheck size={14} />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-card border border-night-line bg-night-900/40 px-5 py-4">
          <span className="mt-[2px] shrink-0 text-[#F5C88A]">
            <IconLock size={17} />
          </span>
          <p className="text-[13.5px] leading-[21px] text-night-muted">
            Northstar US / Search is not in this figure. It reports in USD on an America/New_York day
            boundary, and no exchange-rate basis is configured for this workspace, so HELM shows it
            side by side instead of inventing a combined number.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReconciliationColumn({
  provider,
  title,
  value,
  unit,
  rows,
}: {
  provider: 'google_ads' | 'meta_ads';
  title: string;
  value: string;
  unit: string;
  rows: [string, string][];
}) {
  return (
    <div className="p-6 lg:p-7">
      <div className="flex items-center gap-2.5">
        <ProviderMark provider={provider} size={18} />
        <p className="text-[13px] font-medium text-night-ink">{title}</p>
      </div>
      <p className="mt-4 text-[36px] font-semibold leading-none text-night-muted tnum">{value}</p>
      <p className="mt-2 text-[13px] text-night-faint">{unit}</p>
      <dl className="mono mt-6 space-y-2.5 border-t border-night-line pt-4 text-[11.5px]">
        {rows.map(([label, detail]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-night-faint">{label}</dt>
            <dd className="text-right text-night-muted">{detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ============================================================
   Movement 02 — Decision brief
   Sticky product surface on one side, scrolling evidence on the other.
   ============================================================ */

const BRIEF_STEPS = [
  {
    step: 'What changed',
    body: 'Prospecting / Broad 04 raised daily budget 40% on 4 August. Spend rose 29% while mapped purchases grew 4%.',
    meta: 'Observed · Meta Ads · 2385-DEMO-2110',
  },
  {
    step: 'Why it matters',
    body: 'Cost per purchase moved from a ₹1,869 four-week baseline to ₹2,449. That is the single largest efficiency movement in the workspace.',
    meta: 'Calculated · spend ÷ mapped purchases',
  },
  {
    step: 'The evidence',
    body: 'Frequency climbed 3.2 → 4.8 and crossed 4.0 on 11 August. The leading creative’s 3-second view rate fell 32% → 24%. Google High Intent lost 18% impression share to budget over the same period.',
    meta: 'Observed + calculated · 4 evidence records',
  },
  {
    step: 'Estimated impact',
    body: '₹42k – ₹68k of acquisition cost over the next 14 days if current rates persist. Shown as a range because it is modelled, not measured.',
    meta: 'Inferred · 55 × (Meta CPA band − Google CPA band)',
  },
  {
    step: 'Recommendation',
    body: 'Shift up to ₹1,20,000 from Broad 04 into Non-Brand / High Intent for 14 days, with named stop conditions.',
    meta: 'Proposed · not executed',
  },
  {
    step: 'Your decision',
    body: 'Approve, request a revision, save it for later, or dismiss it. Whatever you choose is recorded with the basis it was made on.',
    meta: 'Human control · nothing runs automatically',
  },
];

export function MovementDecisionBrief() {
  return (
    <section
      id="decision-layer"
      className="relative border-t border-night-line px-5 py-20 sm:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-[52ch]">
          <Kicker index="02" label="Decision brief" />
          <h2 className="pub-section-title mt-5 text-night-ink">
            A morning brief built around what deserves attention.
          </h2>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
          {/* Sticky product surface: the light product world, shown honestly */}
          <div className="lg:sticky lg:top-[104px] lg:self-start">
            <div className="overflow-hidden rounded-editorial border border-line bg-surface shadow-lift-dark">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-subtle px-5 py-3">
                <p className="text-[13px] font-semibold text-ink-950">Briefing</p>
                <p className="mono text-[11px] text-ink-400">Monday, 24 August</p>
              </div>

              <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
                {[
                  ['Spend', '₹39.6L', '+9.7%', 'text-ink-500'],
                  ['ROAS', '4.20×', '−4.2%', 'text-bad'],
                  ['CPA', '₹1,746', '+7.1%', 'text-bad'],
                ].map(([label, value, delta, tone]) => (
                  <div key={label} className="px-4 py-3.5">
                    <p className="micro-label">{label}</p>
                    <p className="mono mt-1.5 text-[17px] font-medium text-ink-950">{value}</p>
                    <p className={cn('mono mt-0.5 text-[11.5px]', tone)}>{delta}</p>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4">
                <p className="micro-label">Needs a decision</p>
                <h3 className="mt-2.5 text-[16px] font-semibold leading-snug text-ink-950">
                  Meta prospecting CPA rose 31% after frequency crossed 4.6
                </h3>
                <p className="mt-2 text-[13.5px] leading-[20px] text-ink-500">
                  Broad 04 raised budget 40% into a fatiguing creative while the cheaper buyer was capped.
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="mono text-[11.5px] text-bad">₹42k – ₹68k exposure</span>
                  <span className="mono text-[11.5px] text-ink-400">High confidence</span>
                  <span className="mono text-[11.5px] text-ink-400">30 complete days</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex h-9 items-center rounded-control bg-action-200 px-3 text-[13px] font-medium text-action-ink">
                    Approve recommendation
                  </span>
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line-strong px-3 text-[13px] text-ink-700">
                    <IconEvidence size={15} />
                    Open evidence
                  </span>
                </div>
              </div>

              <div className="border-t border-line bg-surface-subtle px-5 py-3">
                <p className="mono text-[11px] text-ink-400">
                  3 accounts · 25 Jul – 23 Aug · Synced 8 min ago
                </p>
              </div>
            </div>
            <p className="mono mt-3 text-[11px] text-night-faint">
              Illustrative sample workspace. Numbers are not customer data.
            </p>
          </div>

          {/* Scrolling evidence */}
          <ol className="relative space-y-0 pl-8">
            <span
              className="absolute bottom-6 left-[9px] top-4 w-px bg-gradient-to-b from-[rgba(23,140,138,.55)] via-night-line to-transparent"
              aria-hidden="true"
            />
            {BRIEF_STEPS.map((entry, index) => (
              <li key={entry.step} className="relative border-b border-night-line py-6 last:border-b-0">
                <span
                  className={cn(
                    'absolute -left-8 top-[26px] h-[9px] w-[9px] rounded-full border',
                    index === BRIEF_STEPS.length - 1
                      ? 'border-action-400 bg-action-400'
                      : 'border-night-line bg-night-800',
                  )}
                  aria-hidden="true"
                />
                <h3 className="text-[17px] font-semibold text-night-ink">{entry.step}</h3>
                <p className="mt-2 max-w-[54ch] text-[15px] leading-[24px] text-night-muted">{entry.body}</p>
                <p className="mono mt-2.5 text-[11px] uppercase tracking-[0.08em] text-night-faint">
                  {entry.meta}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Movement 03 — Creative intelligence
   A wide asset strip tied directly to delivery data.
   ============================================================ */

const CREATIVE_STRIP = [
  {
    variant: 'typographic' as const,
    name: '18 Hours — typographic',
    fatigue: 'Fatigued',
    tone: 'bad' as const,
    rows: [
      ['Frequency', '5.2'],
      ['3-sec view rate', '24%'],
      ['Hold rate', '31%'],
      ['CPA', '₹2,684'],
      ['Share of spend', '54%'],
    ],
    note: 'Carried most of Broad 04. View rate fell 8 points across the window.',
  },
  {
    variant: 'product-proof' as const,
    name: 'Condensation macro',
    fatigue: 'Watch',
    tone: 'warn' as const,
    rows: [
      ['Frequency', '3.9'],
      ['3-sec view rate', '29%'],
      ['Hold rate', '38%'],
      ['CPA', '₹2,186'],
      ['Share of spend', '31%'],
    ],
    note: 'Best hold rate in the account, but frequency is approaching 4.',
  },
  {
    variant: 'field-use' as const,
    name: 'First light run',
    fatigue: 'Healthy',
    tone: 'good' as const,
    rows: [
      ['Frequency', '2.4'],
      ['3-sec view rate', '34%'],
      ['Hold rate', '42%'],
      ['CPA', '₹1,692'],
      ['Share of spend', '15%'],
    ],
    note: 'Entered on 29 July. Best efficiency of the three variants.',
  },
];

export function MovementCreativeIntelligence() {
  return (
    <section className="relative border-t border-night-line px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-end">
          <div>
            <Kicker index="03" label="Creative intelligence" />
            <h2 className="pub-section-title mt-5 max-w-[20ch] text-night-ink">
              Performance falls after the creative starts repeating itself. See it sooner.
            </h2>
          </div>
          <p className="text-[16px] leading-[26px] text-night-muted lg:pb-2">
            Each asset carries its own frequency, view rate, hold rate, spend share and cost per purchase.
            Generating a new image is the easy part. Knowing which one to replace, and what to test instead,
            is the product.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {CREATIVE_STRIP.map((asset) => (
            <figure key={asset.name} className="overflow-hidden rounded-editorial border border-night-line bg-night-900/55">
              <div className="aspect-[4/5] w-full overflow-hidden border-b border-night-line">
                <ArcBottlePoster variant={asset.variant} label={`Arc Bottle creative — ${asset.name}`} />
              </div>
              <figcaption className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-medium leading-tight text-night-ink">{asset.name}</p>
                  <span
                    className={cn(
                      'mono shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-[0.07em]',
                      asset.tone === 'bad' && 'border-[#FF9BAE]/40 text-[#FF9BAE]',
                      asset.tone === 'warn' && 'border-[#F5C88A]/40 text-[#F5C88A]',
                      asset.tone === 'good' && 'border-[#7BDCB5]/40 text-[#7BDCB5]',
                    )}
                  >
                    {asset.fatigue}
                  </span>
                </div>
                <dl className="mono mt-4 space-y-2 border-t border-night-line pt-3.5 text-[11.5px]">
                  {asset.rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-night-faint">{label}</dt>
                      <dd className="text-night-muted">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3.5 border-t border-night-line pt-3 text-[12px] leading-[18px] text-night-faint">
                  {asset.note}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mono mt-6 text-[11.5px] text-night-faint">
          3-second view rate = 3-second video plays ÷ impressions. Derived, and labelled as derived. HELM does
          not publish a universal “hook score”.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   Movement 04 — Account optionality
   Offset product surface with annotation callouts around it.
   ============================================================ */

const SCOPE_ROWS = [
  { provider: 'google_ads' as const, name: 'Northstar India / Search', id: '187-DEM-9021', state: 'Healthy · 8 min ago', checked: true },
  { provider: 'google_ads' as const, name: 'Northstar India / Performance Max', id: '605-DEM-7740', state: 'Healthy · 8 min ago', checked: true },
  { provider: 'meta_ads' as const, name: 'Northstar India / Prospecting', id: '2385-DEMO-2110', state: 'Healthy · 14 min ago', checked: true },
  { provider: 'meta_ads' as const, name: 'Northstar India / Retargeting', id: '2385-DEMO-2911', state: 'Delayed · 19 hours', checked: true, warn: true },
  { provider: 'google_ads' as const, name: 'Northstar US / Search', id: '792-DEM-3504', state: 'USD · cannot blend', checked: false, disabled: true },
];

export function MovementAccountOptionality() {
  return (
    <section className="relative border-t border-night-line px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center">
          <div className="lg:pr-6">
            <Kicker index="04" label="Account optionality" />
            <h2 className="pub-section-title mt-5 text-night-ink">Every account is one command away.</h2>
            <p className="mt-6 max-w-[46ch] text-[16px] leading-[26px] text-night-muted">
              Changing which accounts you are looking at is an analytic control, not a settings trip. Check the
              accounts you want, apply once, and the page you were already on updates in place.
            </p>

            <ul className="mt-8 space-y-4 border-t border-night-line pt-6">
              {[
                ['Staged selection', 'Checking rows edits a draft. Nothing refetches until you apply.'],
                ['One atomic refresh', 'Applying resolves one scope and updates every data region together.'],
                ['Health in the list', 'Freshness and provider state are visible before you commit to a view.'],
                ['Compatibility is enforced', 'Accounts that cannot be blended say so instead of producing a wrong total.'],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-[3px] shrink-0 text-night-accent">
                    <IconScope size={17} />
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-medium text-night-ink">{title}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-[20px] text-night-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* The account scope command, offset and lifted */}
          <div className="relative lg:translate-x-6">
            <div className="overflow-hidden rounded-editorial border border-line bg-surface shadow-lift-dark">
              <div className="border-b border-line px-4 py-3">
                <div className="flex h-10 items-center gap-2.5 rounded-control border border-line-strong bg-surface-sunk px-3">
                  <span className="text-ink-400">
                    <IconSearch size={16} />
                  </span>
                  <span className="text-[14px] text-ink-400">Search accounts and groups</span>
                  <span className="mono ml-auto rounded border border-line px-1.5 py-0.5 text-[10.5px] text-ink-400">
                    /
                  </span>
                </div>
              </div>

              <div className="border-b border-line px-4 py-3">
                <p className="micro-label">Recent scopes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['India · Google + Meta', 'Meta Ads only', 'Northstar India / Search'].map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-line bg-surface-subtle px-2.5 py-1 text-[12px] text-ink-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-b border-line px-4 py-3">
                <p className="micro-label">Saved account groups</p>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-control bg-helm-100/50 px-3 py-2.5">
                  <span className="text-[13.5px] font-medium text-ink-950">India · Google + Meta</span>
                  <span className="mono text-[11px] text-ink-500">4 accounts</span>
                </div>
              </div>

              <ul className="divide-y divide-line">
                {SCOPE_ROWS.map((row) => (
                  <li
                    key={row.id}
                    className={cn('flex items-center gap-3 px-4 py-3', row.disabled && 'opacity-55')}
                  >
                    <span
                      className={cn(
                        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border',
                        row.checked ? 'border-helm-500 bg-helm-500 text-white' : 'border-line-strong bg-surface',
                      )}
                      aria-hidden="true"
                    >
                      {row.checked ? <IconCheck size={12} strokeWidth={2.8} /> : null}
                    </span>
                    <ProviderMark provider={row.provider} size={17} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-ink-950">{row.name}</span>
                      <span className="mono block truncate text-[11px] text-ink-400">{row.id}</span>
                    </span>
                    <span
                      className={cn(
                        'mono shrink-0 text-[11px]',
                        row.warn ? 'text-warn' : row.disabled ? 'text-ink-400' : 'text-ink-500',
                      )}
                    >
                      {row.state}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-subtle px-4 py-3">
                <span className="text-[12.5px] text-ink-500">4 selected · 1 cannot be blended</span>
                <div className="flex gap-2">
                  <span className="inline-flex h-9 items-center rounded-control border border-line-strong px-3 text-[13px] text-ink-700">
                    Connect another source
                  </span>
                  <span className="inline-flex h-9 items-center rounded-control bg-helm-500 px-3 text-[13px] font-medium text-white">
                    Apply scope
                  </span>
                </div>
              </div>
            </div>

            <p className="mono mt-3 text-[11px] text-night-faint">
              Sample accounts. Native provider IDs are display metadata and never enter a URL.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Movement 05 — Evidence and control
   A restrained provenance ledger, with the security subsection inside it.
   ============================================================ */

const PROVENANCE = [
  ['Source accounts', '187-DEM-9021 · 605-DEM-7740 · 2385-DEMO-2110'],
  ['Date window', '25 Jul – 23 Aug 2026 inclusive · 30 complete Asia/Kolkata days'],
  ['Comparison', '25 Jun – 24 Jul 2026 inclusive'],
  ['Freshness', 'Complete through 23 Aug. The current partial day is excluded.'],
  ['Attribution', 'Google primary Purchase + Meta Purchase, normalized to 7-day click'],
  ['Excluded', 'Northstar US / Search — USD and a different reporting day'],
  ['Excluded', 'Northstar India / Retargeting — sync 19 hours behind'],
  ['Confidence', 'High. Single-account observation, 30 complete days, no modelling in the finding.'],
  ['Review state', 'Waiting for a decision since 07:44 IST'],
  ['Actions taken', 'None. HELM has not changed anything in either platform.'],
];

export function MovementEvidenceAndControl() {
  return (
    <section id="method" className="relative border-t border-night-line px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <div className="lg:sticky lg:top-[104px] lg:self-start">
            <Kicker index="05" label="Evidence and control" />
            <h2 className="pub-section-title mt-5 text-night-ink">
              When HELM has an opinion, it carries receipts.
            </h2>
            <p className="mt-6 max-w-[42ch] text-[16px] leading-[26px] text-night-muted">
              Every recommendation publishes the accounts it read, the exact window, what was left out and
              why, how confident it is, and what has been done about it. If a number cannot be supported, it
              says so instead of estimating.
            </p>
          </div>

          <div>
            <div className="overflow-hidden rounded-editorial border border-night-line bg-night-900/55">
              <div className="border-b border-night-line px-6 py-4">
                <p className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">
                  Provenance ledger
                </p>
                <p className="mt-1.5 text-[14px] text-night-ink">
                  Meta prospecting CPA rose 31% after frequency crossed 4.6
                </p>
              </div>
              <dl>
                {PROVENANCE.map(([label, value], index) => (
                  <div
                    key={`${label}-${index}`}
                    className="grid gap-1 border-b border-night-line px-6 py-3.5 last:border-b-0 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-4"
                  >
                    <dt className="mono text-[11px] uppercase tracking-[0.08em] text-night-faint">{label}</dt>
                    <dd className="text-[13.5px] leading-[20px] text-night-muted">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Security and access */}
            <div id="security" className="mt-10 rounded-editorial border border-night-line bg-night-900/40 p-6 lg:p-7">
              <div className="flex items-center gap-2.5">
                <span className="text-night-accent">
                  <IconShield size={19} />
                </span>
                <h3 className="text-[19px] font-semibold text-night-ink">Security and access</h3>
              </div>
              <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[23px] text-night-muted">
                Signing in with a work identity is separate from authorizing an ad account. Connecting an
                account grants read access to reporting only.
              </p>
              <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {[
                  ['Read-only by default', 'HELM does not change budgets, bids, status, or creative in either platform.'],
                  ['Separate authorizations', 'Identity sign-in, Google Ads access and Meta Ads access are three distinct grants.'],
                  ['Explicit disconnect', 'Disconnecting stops future syncs. Deleting stored history is a separate, confirmed action.'],
                  ['Scoped membership', 'A workspace is the access boundary. Every request is authorized against current membership.'],
                ].map(([title, body]) => (
                  <li key={title} className="border-t border-night-line pt-4">
                    <p className="text-[14px] font-medium text-night-ink">{title}</p>
                    <p className="mt-1.5 text-[13px] leading-[20px] text-night-muted">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Closing composition — dark night into the cool product field.
   ============================================================ */

export function ClosingTransition() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="h-28 w-full sm:h-36"
        style={{ background: 'linear-gradient(to bottom, #08201F 0%, #143739 42%, #4E8C89 78%, #EFF6F5 100%)' }}
        aria-hidden="true"
      />
      <div className="relative bg-canvas px-5 pb-20 pt-4 sm:px-8 lg:pb-28">
        <div className="mx-auto max-w-[1400px]">
          {/* The spine arrives at an empty final state */}
          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-line-strong to-line-strong" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-full bg-helm-500" aria-hidden="true" />
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-end">
            <h2 className="pub-section-title max-w-[16ch] text-ink-950">
              The next decision should not begin with six tabs.
            </h2>
            <div className="flex flex-wrap gap-3 lg:justify-end lg:pb-3">
              <a
                href="#decision-layer"
                className="inline-flex h-12 items-center gap-2 rounded-control bg-action-200 px-6 text-[16px] font-medium text-action-ink transition-colors duration-[110ms] hover:bg-action-400"
              >
                View the product
                <IconArrowRight size={18} />
              </a>
              <a
                href="/signin"
                className="inline-flex h-12 items-center rounded-control border border-line-strong bg-surface px-6 text-[16px] font-medium text-ink-950 transition-colors duration-[110ms] hover:bg-surface-subtle"
              >
                Sign in
              </a>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-6">
            <span className="inline-flex items-center gap-2 text-[13px] text-ink-500">
              <GoogleAdsMark size={16} />
              Google Ads
            </span>
            <span className="inline-flex items-center gap-2 text-[13px] text-ink-500">
              <MetaAdsMark size={16} />
              Meta Ads
            </span>
            <span className="mono text-[11.5px] text-ink-400">Read-only connections by default</span>
          </div>
        </div>
      </div>
    </section>
  );
}
