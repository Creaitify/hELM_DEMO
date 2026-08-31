/**
 * A report, as a structure rather than as a string.
 *
 * The documents used to be built as Markdown and rendered from there, which
 * put a ceiling on them: a bar chart cannot survive a round trip through
 * Markdown, so every report was a wall of figures and the reader had to do the
 * comparing themselves. Building the structure first means each format can
 * render a chart the way that format can — inline SVG in HTML and Word, drawn
 * vectors in the PDF, and an honest labelled list in the Markdown, which is a
 * plain-text format and should not pretend otherwise.
 *
 * The blocks are deliberately few. A report needs a heading, a sentence, a
 * list, a table, a handful of figures and three shapes of chart. Anything more
 * is a layout language, and this is not one.
 */

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  /** The opening paragraph, set larger. One per report. */
  | { kind: 'lede'; text: string }
  | { kind: 'para'; text: string }
  /** A boxed statement that changes how the rest should be read. */
  | { kind: 'callout'; tone: Tone; title: string; text: string }
  | { kind: 'list'; items: string[] }
  /** A row of headline figures. */
  | { kind: 'stats'; items: { label: string; value: string; note?: string }[] }
  | { kind: 'table'; columns: string[]; rows: string[][]; numeric?: boolean[] }
  /** Ranked horizontal bars, all one direction. */
  | {
      kind: 'bars';
      title: string;
      note?: string;
      rows: { label: string; value: number; display: string; tone?: Tone }[];
    }
  /** Change against a baseline, drawn either side of a zero line. */
  | {
      kind: 'diverging';
      title: string;
      note?: string;
      /** Positive is worse unless `positiveIsGood`. */
      positiveIsGood?: boolean;
      rows: { label: string; value: number; display: string }[];
    }
  /** A trend over time. Nulls are gaps, never zeroes. */
  | {
      kind: 'line';
      title: string;
      note?: string;
      points: { label: string; value: number | null }[];
      /** Rendered at the axis ends so the line has a scale. */
      lowLabel: string;
      highLabel: string;
    }
  | { kind: 'rule' }
  | { kind: 'footnote'; text: string };

export type ReportDoc = {
  title: string;
  subtitle?: string;
  meta: { label: string; value: string }[];
  blocks: Block[];
};

/* ------------------------------------------------------------- markdown -- */

const TONE_WORD: Record<Tone, string> = {
  good: 'good',
  warn: 'watch',
  bad: 'problem',
  neutral: 'note',
};

/**
 * Markdown keeps every figure and drops every drawing.
 *
 * A chart rendered as ASCII art is unreadable in a diff, unreadable in a
 * terminal at another width, and unreadable to a screen reader. The values are
 * what the chart was made of, so the values are what a plain-text format gets.
 */
export function toMarkdown(doc: ReportDoc): string {
  const out: string[] = [`# ${doc.title}`, ''];
  if (doc.subtitle) out.push(doc.subtitle, '');
  for (const entry of doc.meta) out.push(`**${entry.label}** ${entry.value}  `);
  if (doc.meta.length) out.push('');

  for (const block of doc.blocks) {
    switch (block.kind) {
      case 'heading':
        out.push(`${'#'.repeat(block.level + 1)} ${block.text}`, '');
        break;
      case 'lede':
      case 'para':
        out.push(block.text, '');
        break;
      case 'callout':
        out.push(`> **${block.title}** — ${block.text}`, '');
        break;
      case 'list':
        for (const item of block.items) out.push(`- ${item}`);
        out.push('');
        break;
      case 'stats':
        for (const item of block.items) {
          out.push(`- **${item.label}** ${item.value}${item.note ? ` — ${item.note}` : ''}`);
        }
        out.push('');
        break;
      case 'table': {
        out.push(`| ${block.columns.join(' | ')} |`);
        out.push(`| ${block.columns.map((_, index) => (block.numeric?.[index] ? '---:' : '---')).join(' | ')} |`);
        for (const row of block.rows) out.push(`| ${row.join(' | ')} |`);
        out.push('');
        break;
      }
      case 'bars':
        out.push(`**${block.title}**`, '');
        if (block.note) out.push(block.note, '');
        for (const row of block.rows) {
          out.push(`- ${row.label} — ${row.display}${row.tone ? ` (${TONE_WORD[row.tone]})` : ''}`);
        }
        out.push('');
        break;
      case 'diverging':
        out.push(`**${block.title}**`, '');
        if (block.note) out.push(block.note, '');
        for (const row of block.rows) out.push(`- ${row.label} — ${row.display}`);
        out.push('');
        break;
      case 'line': {
        out.push(`**${block.title}**`, '');
        if (block.note) out.push(block.note, '');
        const known = block.points.filter((point) => point.value !== null);
        out.push(
          `Ranges from ${block.lowLabel} to ${block.highLabel} across ${known.length} days` +
            `${known.length < block.points.length ? `, with ${block.points.length - known.length} days reporting nothing` : ''}.`,
          '',
        );
        break;
      }
      case 'rule':
        out.push('---', '');
        break;
      case 'footnote':
        out.push(`_${block.text}_`, '');
        break;
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/* ----------------------------------------------------------------- html -- */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Emphasis is the only inline markup a report needs. */
function inline(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

const FILL: Record<Tone, string> = {
  good: '#0a7f59',
  warn: '#a4620f',
  bad: '#c31f3c',
  neutral: '#111827',
};

const BAR_W = 680;
const LABEL_W = 200;
const VALUE_W = 128;

/** A label that would overrun its column is cut, with the cut made visible. */
function fit(text: string, chars: number): string {
  return text.length > chars ? `${text.slice(0, chars - 1)}…` : text;
}

function barsSvg(block: Extract<Block, { kind: 'bars' }>): string {
  const rows = block.rows.slice(0, 12);
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  const rowH = 30;
  const height = rows.length * rowH + 8;
  const labelW = LABEL_W;
  const trackW = BAR_W - labelW - VALUE_W;

  const bars = rows
    .map((row, index) => {
      const y = index * rowH + 6;
      const w = Math.max(2, (Math.abs(row.value) / max) * trackW);
      return (
        `<rect x="${labelW}" y="${y}" width="${trackW}" height="14" rx="7" fill="#f3f4f6"/>` +
        `<rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="14" rx="7" fill="${FILL[row.tone ?? 'neutral']}"/>` +
        `<text x="${labelW - 10}" y="${y + 11}" text-anchor="end" font-size="11.5" fill="#374151">${escapeHtml(fit(row.label, 32))}</text>` +
        `<text x="${labelW + trackW + 10}" y="${y + 11}" font-size="11.5" font-weight="600" fill="#111827">${escapeHtml(fit(row.display, 20))}</text>`
      );
    })
    .join('');

  return `<svg viewBox="0 0 ${BAR_W} ${height}" width="100%" role="img" aria-label="${escapeHtml(block.title)}">${bars}</svg>`;
}

function divergingSvg(block: Extract<Block, { kind: 'diverging' }>): string {
  const rows = block.rows.slice(0, 12);
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0.01);
  const rowH = 30;
  const height = rows.length * rowH + 20;
  const labelW = LABEL_W;
  const trackW = BAR_W - labelW - VALUE_W;
  const mid = labelW + trackW / 2;

  const good = block.positiveIsGood ? FILL.good : FILL.bad;
  const bad = block.positiveIsGood ? FILL.bad : FILL.good;

  const bars = rows
    .map((row, index) => {
      const y = index * rowH + 6;
      const w = Math.max(1.5, (Math.abs(row.value) / max) * (trackW / 2));
      const x = row.value >= 0 ? mid : mid - w;
      return (
        `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="14" rx="3" fill="${row.value >= 0 ? good : bad}"/>` +
        `<text x="${labelW - 10}" y="${y + 11}" text-anchor="end" font-size="11.5" fill="#374151">${escapeHtml(fit(row.label, 32))}</text>` +
        `<text x="${labelW + trackW + 10}" y="${y + 11}" font-size="11.5" font-weight="600" fill="#111827">${escapeHtml(fit(row.display, 20))}</text>`
      );
    })
    .join('');

  return (
    `<svg viewBox="0 0 ${BAR_W} ${height}" width="100%" role="img" aria-label="${escapeHtml(block.title)}">` +
    `<line x1="${mid}" x2="${mid}" y1="0" y2="${rows.length * rowH + 2}" stroke="#d1d5db" stroke-width="1"/>` +
    bars +
    `<text x="${mid}" y="${height - 2}" text-anchor="middle" font-size="10" fill="#9ca3af">no change</text>` +
    `</svg>`
  );
}

function lineSvg(block: Extract<Block, { kind: 'line' }>): string {
  const height = 180;
  const pad = { top: 14, right: 12, bottom: 26, left: 54 };
  const plotW = BAR_W - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = block.points.map((point) => point.value).filter((value): value is number => value !== null);
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (index: number) => pad.left + (index / Math.max(1, block.points.length - 1)) * plotW;
  const y = (value: number) => pad.top + plotH - ((value - min) / span) * plotH;

  // A gap in the data breaks the line rather than being bridged, because a
  // bridged gap draws a day that was never measured.
  let path = '';
  let open = false;
  block.points.forEach((point, index) => {
    if (point.value === null) {
      open = false;
      return;
    }
    path += `${open ? 'L' : 'M'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`;
    open = true;
  });

  const first = block.points[0]?.label ?? '';
  const last = block.points[block.points.length - 1]?.label ?? '';

  return (
    `<svg viewBox="0 0 ${BAR_W} ${height}" width="100%" role="img" aria-label="${escapeHtml(block.title)}">` +
    `<line x1="${pad.left}" x2="${pad.left + plotW}" y1="${pad.top}" y2="${pad.top}" stroke="#e5e7eb"/>` +
    `<line x1="${pad.left}" x2="${pad.left + plotW}" y1="${pad.top + plotH}" y2="${pad.top + plotH}" stroke="#e5e7eb"/>` +
    `<text x="${pad.left - 8}" y="${pad.top + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${escapeHtml(block.highLabel)}</text>` +
    `<text x="${pad.left - 8}" y="${pad.top + plotH + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${escapeHtml(block.lowLabel)}</text>` +
    `<path d="${path}" fill="none" stroke="#111827" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<text x="${pad.left}" y="${height - 8}" font-size="10" fill="#9ca3af">${escapeHtml(first)}</text>` +
    `<text x="${pad.left + plotW}" y="${height - 8}" text-anchor="end" font-size="10" fill="#9ca3af">${escapeHtml(last)}</text>` +
    `</svg>`
  );
}

const CALLOUT_BORDER: Record<Tone, string> = {
  good: '#0a7f59',
  warn: '#a4620f',
  bad: '#c31f3c',
  neutral: '#6b7280',
};

/** The body of the document, without the page chrome around it. */
export function toHtmlBody(doc: ReportDoc): string {
  const out: string[] = [];

  out.push(`<h1>${inline(doc.title)}</h1>`);
  if (doc.subtitle) out.push(`<p class="subtitle">${inline(doc.subtitle)}</p>`);
  if (doc.meta.length) {
    out.push(
      `<table class="meta"><tbody>${doc.meta
        .map((entry) => `<tr><th>${inline(entry.label)}</th><td>${inline(entry.value)}</td></tr>`)
        .join('')}</tbody></table>`,
    );
  }

  for (const block of doc.blocks) {
    switch (block.kind) {
      case 'heading':
        out.push(`<h${block.level + 1}>${inline(block.text)}</h${block.level + 1}>`);
        break;
      case 'lede':
        out.push(`<p class="lede">${inline(block.text)}</p>`);
        break;
      case 'para':
        out.push(`<p>${inline(block.text)}</p>`);
        break;
      case 'callout':
        out.push(
          `<div class="callout" style="border-left-color:${CALLOUT_BORDER[block.tone]}">` +
            `<p class="callout-title">${inline(block.title)}</p>` +
            `<p>${inline(block.text)}</p></div>`,
        );
        break;
      case 'list':
        out.push(`<ul>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
        break;
      case 'stats':
        out.push(
          `<div class="stats">${block.items
            .map(
              (item) =>
                `<div class="stat"><p class="stat-label">${inline(item.label)}</p>` +
                `<p class="stat-value">${inline(item.value)}</p>` +
                `${item.note ? `<p class="stat-note">${inline(item.note)}</p>` : ''}</div>`,
            )
            .join('')}</div>`,
        );
        break;
      case 'table':
        out.push(
          `<table class="data"><thead><tr>${block.columns
            .map((column, index) => `<th${block.numeric?.[index] ? ' class="num"' : ''}>${inline(column)}</th>`)
            .join('')}</tr></thead><tbody>${block.rows
            .map(
              (row) =>
                `<tr>${row
                  .map((cell, index) => `<td${block.numeric?.[index] ? ' class="num"' : ''}>${inline(cell)}</td>`)
                  .join('')}</tr>`,
            )
            .join('')}</tbody></table>`,
        );
        break;
      case 'bars':
      case 'diverging':
      case 'line': {
        const svg =
          block.kind === 'bars' ? barsSvg(block) : block.kind === 'diverging' ? divergingSvg(block) : lineSvg(block);
        if (!svg) break;
        out.push(
          `<figure class="chart"><figcaption>${inline(block.title)}` +
            `${block.note ? `<span>${inline(block.note)}</span>` : ''}</figcaption>${svg}</figure>`,
        );
        break;
      }
      case 'rule':
        out.push('<hr />');
        break;
      case 'footnote':
        out.push(`<p class="footnote">${inline(block.text)}</p>`);
        break;
    }
  }

  return out.join('\n');
}

/** The stylesheet both the HTML download and the Word document use. */
export const REPORT_CSS = `
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Segoe UI', Calibri, system-ui, sans-serif; font-size: 11.5pt; line-height: 1.55;
         color: #1f2937; max-width: 820px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 26pt; line-height: 1.15; margin: 0 0 6px; color: #111827; letter-spacing: -0.02em; }
  h2 { font-size: 15pt; margin: 34px 0 10px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 12.5pt; margin: 22px 0 6px; color: #111827; }
  p { margin: 0 0 10px; }
  .subtitle { color: #6b7280; font-size: 12pt; margin-bottom: 18px; }
  .lede { font-size: 13.5pt; line-height: 1.6; color: #111827; margin-bottom: 14px; }
  table.meta { border-collapse: collapse; margin: 0 0 26px; font-size: 10.5pt; }
  table.meta th { text-align: left; padding: 2px 18px 2px 0; color: #6b7280; font-weight: 500; white-space: nowrap; }
  table.meta td { padding: 2px 0; color: #111827; }
  table.data { border-collapse: collapse; width: 100%; margin: 12px 0 18px; font-size: 10.5pt; }
  table.data th { text-align: left; border-bottom: 2px solid #111827; padding: 7px 10px 7px 0; color: #111827; }
  table.data td { border-bottom: 1px solid #e5e7eb; padding: 7px 10px 7px 0; }
  table.data .num { text-align: right; font-variant-numeric: tabular-nums; }
  .stats { display: flex; flex-wrap: wrap; gap: 0; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin: 14px 0 22px; }
  .stat { flex: 1 1 150px; padding: 14px 16px; border-right: 1px solid #e5e7eb; }
  .stat:last-child { border-right: 0; }
  .stat-label { font-size: 8.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; }
  .stat-value { font-size: 17pt; font-weight: 600; color: #111827; margin: 0; letter-spacing: -0.02em; }
  .stat-note { font-size: 9pt; color: #6b7280; margin: 5px 0 0; }
  .callout { border-left: 3px solid #6b7280; background: #f9fafb; padding: 12px 16px; margin: 14px 0 20px; border-radius: 0 8px 8px 0; }
  .callout-title { font-weight: 600; color: #111827; margin: 0 0 4px; }
  .callout p:last-child { margin: 0; }
  figure.chart { margin: 16px 0 26px; }
  figure.chart figcaption { font-weight: 600; color: #111827; margin-bottom: 10px; font-size: 11.5pt; }
  figure.chart figcaption span { display: block; font-weight: 400; color: #6b7280; font-size: 10pt; margin-top: 2px; }
  ul { margin: 0 0 14px; padding-left: 20px; }
  li { margin: 0 0 5px; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0 18px; }
  .footnote { color: #6b7280; font-size: 9.5pt; }
  code { font-family: Consolas, monospace; font-size: 10pt; }
`;

export function toHtmlDocument(doc: ReportDoc): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>${REPORT_CSS}</style></head>
<body>${toHtmlBody(doc)}</body></html>`;
}

/**
 * Word opens HTML that declares itself a Word document, and has since Office
 * 2000 — so the same body and the same stylesheet produce a real editable
 * document rather than a renamed .html that warns on open. The SVG charts
 * survive the trip.
 */
export function toWordDocument(doc: ReportDoc): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>${REPORT_CSS}</style></head>
<body>${toHtmlBody(doc)}</body></html>`;
}
