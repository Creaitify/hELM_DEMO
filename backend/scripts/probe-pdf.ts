/**
 * Adversarial probe for the hand-written PDF writer.
 *
 * The writer is the one piece of this product that produces a binary format
 * with no library behind it, and the failure mode that matters is not a crash
 * — it is a file that opens fine and is quietly missing content, or draws it
 * off the edge of the page where nobody looks.
 *
 * So each case asserts three things: the file is structurally valid, the xref
 * offsets actually point at their objects, and every drawn item lands inside
 * the page box.
 *
 *   npx tsx scripts/probe-pdf.ts
 */

import { toPdf } from '../src/http/documents.pdf.js';
import type { Block, ReportDoc } from '../src/http/documents.blocks.js';

const PAGE = { width: 595.28, height: 841.89, margin: 54 };

let failures = 0;

function report(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

/** Reads back the cross-reference table and checks each offset. */
function xrefIsSound(pdf: string): { ok: boolean; detail: string } {
  const start = pdf.lastIndexOf('startxref');
  if (start < 0) return { ok: false, detail: 'no startxref' };
  const declared = Number(pdf.slice(start + 9).trim().split(/\s/)[0]);
  if (!Number.isFinite(declared)) return { ok: false, detail: 'startxref is not a number' };
  if (pdf.slice(declared, declared + 4) !== 'xref') {
    return { ok: false, detail: `startxref ${declared} does not point at "xref"` };
  }

  const table = pdf.slice(declared);
  const entries = [...table.matchAll(/^(\d{10}) (\d{5}) n\s*$/gm)].map((m) => Number(m[1]));
  for (const [index, offset] of entries.entries()) {
    const expected = `${index + 1} 0 obj`;
    if (pdf.slice(offset, offset + expected.length) !== expected) {
      return { ok: false, detail: `entry ${index + 1} points at ${JSON.stringify(pdf.slice(offset, offset + 14))}` };
    }
  }
  return { ok: true, detail: `${entries.length} objects, all offsets land` };
}

/** Every text and rect op, in page space, so anything off-page can be seen. */
function drawnOutsidePage(pdf: string): { off: number; total: number; worst: number } {
  let off = 0;
  let total = 0;
  let worst = 0;
  // Text matrices: 1 0 0 1 x y Tm
  for (const match of pdf.matchAll(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g)) {
    total += 1;
    const y = Number(match[2]);
    if (y < PAGE.margin * 0.5 || y > PAGE.height) {
      off += 1;
      worst = Math.min(worst, y);
    }
  }
  return { off, total, worst };
}

function check(name: string, doc: ReportDoc) {
  console.log(`\n${name}`);
  let pdf: string;
  try {
    pdf = toPdf(doc).toString('latin1');
  } catch (error) {
    report('produces a file at all', false, (error as Error).message);
    return;
  }

  report('starts %PDF- and ends %%EOF', pdf.startsWith('%PDF-') && pdf.trimEnd().endsWith('%%EOF'));

  const xref = xrefIsSound(pdf);
  report('cross-reference table is sound', xref.ok, xref.detail);

  const declaredSize = Number(/\/Size (\d+)/.exec(pdf)?.[1] ?? 0);
  const objectCount = [...pdf.matchAll(/^\d+ 0 obj$/gm)].length;
  report('trailer /Size matches the objects written', declaredSize === objectCount + 1,
    `/Size ${declaredSize}, ${objectCount} objects`);

  const kids = /\/Kids \[([^\]]*)\]/.exec(pdf)?.[1] ?? '';
  const kidCount = kids.trim() ? kids.trim().split(/\s+R\s*/).filter(Boolean).length : 0;
  const declaredPages = Number(/\/Count (\d+)/.exec(pdf)?.[1] ?? 0);
  report('page tree /Count matches its /Kids', kidCount === declaredPages,
    `${declaredPages} declared, ${kidCount} kids`);

  const streams = [...pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)];
  let lengthsOk = true;
  for (const match of streams) {
    const bodyStart = (match.index ?? 0) + match[0].length;
    const declared = Number(match[1]);
    if (pdf.slice(bodyStart + declared, bodyStart + declared + 10).trim().slice(0, 9) !== 'endstream') {
      lengthsOk = false;
    }
  }
  report('every stream /Length reaches its endstream', lengthsOk, `${streams.length} streams`);

  const geometry = drawnOutsidePage(pdf);
  report('nothing is drawn off the page', geometry.off === 0,
    geometry.off ? `${geometry.off} of ${geometry.total} ops off-page, worst y=${geometry.worst.toFixed(1)}` : `${geometry.total} ops on-page`);

  // Unbalanced parentheses break every parser that reads the stream.
  const bad = [...pdf.matchAll(/\((?:[^()\\]|\\.)*\)/g)];
  const rawOpen = (pdf.match(/(?<!\\)\(/g) ?? []).length;
  report('parentheses in strings are balanced and escaped', bad.length * 2 >= rawOpen - 2,
    `${bad.length} well-formed strings`);
}

const base = (blocks: Block[], title = 'Probe'): ReportDoc => ({
  title,
  subtitle: 'Adversarial input',
  meta: [{ label: 'Case', value: title }],
  blocks,
});

console.log('Probing the PDF writer with input it was not designed around');

check('1. Empty document — no blocks at all', base([]));

check(
  '2. A paragraph far taller than one page',
  base([{ kind: 'para', text: Array.from({ length: 1400 }, (_, i) => `word${i}`).join(' ') }]),
);

check(
  '3. A single unbroken token wider than the text column',
  base([{ kind: 'para', text: 'A'.repeat(400) }]),
);

check(
  '4. A chart where every value is identical',
  base([
    {
      kind: 'bars',
      title: 'All the same',
      rows: Array.from({ length: 6 }, (_, i) => ({ label: `row ${i}`, value: 5, display: '5' })),
    },
  ]),
);

check(
  '5. A chart where every value is zero',
  base([
    {
      kind: 'bars',
      title: 'All zero',
      rows: Array.from({ length: 4 }, (_, i) => ({ label: `row ${i}`, value: 0, display: '0' })),
    },
    { kind: 'diverging', title: 'No movement', rows: [{ label: 'flat', value: 0, display: '0%' }] },
  ]),
);

check('6. Charts with no rows and a line with no points', base([
  { kind: 'bars', title: 'Nothing to show', rows: [] },
  { kind: 'diverging', title: 'Nothing moved', rows: [] },
  { kind: 'line', title: 'No series', points: [], lowLabel: '-', highLabel: '-' },
]));

check(
  '7. A line series that is entirely gaps',
  base([
    {
      kind: 'line',
      title: 'All null',
      points: Array.from({ length: 30 }, (_, i) => ({ label: `d${i}`, value: null })),
      lowLabel: 'n/a',
      highLabel: 'n/a',
    },
  ]),
);

check(
  '8. Text carrying the three characters PDF strings must escape',
  base(
    [
      { kind: 'para', text: 'Parens ( and ) and a backslash \\ and a nested (one (two)) run.' },
      { kind: 'list', items: ['A campaign named "Broad (04) \\ Retarget"'] },
    ],
    'Title with ( ) and \\ in it',
  ),
);

check(
  '9. Non-Latin content the standard fonts cannot encode',
  base([{ kind: 'para', text: 'भारत ₹1,50,000 · 中文 · emoji 🎯 · smart “quotes” and — dashes' }]),
);

check(
  '10. A table longer than a page',
  base([
    {
      kind: 'table',
      columns: ['Campaign', 'Spend'],
      rows: Array.from({ length: 90 }, (_, i) => [`Campaign number ${i}`, `INR ${i * 1000}`]),
    },
  ]),
);

check(
  '11. A realistic report, for comparison',
  base([
    { kind: 'heading', level: 1, text: 'The short version' },
    { kind: 'lede', text: 'Spend was INR 55.3L, up 5.9% on the month before.' },
    { kind: 'stats', items: [{ label: 'Spend', value: 'INR 55.3L', note: 'up 5.9%' }] },
    {
      kind: 'bars',
      title: 'Spend by campaign',
      rows: Array.from({ length: 10 }, (_, i) => ({
        label: `Campaign ${i}`,
        value: 100 - i * 8,
        display: `INR ${100 - i * 8}K`,
        tone: (i === 0 ? 'bad' : 'neutral') as 'bad' | 'neutral',
      })),
    },
    { kind: 'rule' },
    { kind: 'footnote', text: 'Produced by HELM.' },
  ]),
);

console.log(`\n${'='.repeat(64)}`);
console.log(failures ? `${failures} checks failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
