import type { Block, ReportDoc, Tone } from './documents.blocks.js';

/**
 * The report as a PDF, charts included.
 *
 * Written by hand rather than pulled in as a dependency. A headless browser to
 * print one memo is a hundred megabytes and a sandbox to manage, and the thing
 * being drawn here is rectangles, lines and Helvetica — which is exactly what
 * a PDF content stream is made of. The alternative is a real supply chain for
 * a page of bars.
 *
 * The charts are drawn, not described. A reader who opens the PDF sees the
 * same shapes the HTML shows, because both are rendered from the same blocks.
 */

const PAGE = { width: 595.28, height: 841.89, margin: 54 }; // A4 at 72dpi
const USABLE = PAGE.width - PAGE.margin * 2;
const LEADING = 1.34;

const RGB: Record<Tone, [number, number, number]> = {
  good: [0.04, 0.5, 0.35],
  warn: [0.64, 0.38, 0.06],
  bad: [0.76, 0.12, 0.24],
  neutral: [0.07, 0.09, 0.15],
};
const GREY: [number, number, number] = [0.95, 0.96, 0.97];
const RULE: [number, number, number] = [0.82, 0.84, 0.86];
const MUTED: [number, number, number] = [0.42, 0.45, 0.5];
const INK: [number, number, number] = [0.07, 0.09, 0.15];

/** One drawable thing, already positioned relative to its own top. */
type Item =
  | { kind: 'text'; text: string; size: number; bold: boolean; x: number; color: [number, number, number]; align?: 'right' }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: [number, number, number] }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: [number, number, number] };

/** A block of items that must not be split across a page break. */
type Chunk = { height: number; items: { item: Item; dy: number }[]; breakable: boolean };

/**
 * PDF strings escape three characters and the standard fonts are WinAnsi, so
 * anything outside that range is transliterated rather than written as a byte
 * the viewer renders as a box.
 */
function pdfText(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/₹/g, 'INR ')
    .replace(/×/g, 'x')
    .replace(/[·•]/g, '-')
    .replace(/→/g, '->')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/** Helvetica's average advance is close enough to wrap on without metrics. */
function wrap(text: string, size: number, width: number): string[] {
  const perLine = Math.max(8, Math.floor(width / (size * 0.5)));
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > perLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Bold runs cannot switch font mid-line, so the markers are dropped. */
function plain(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
}

function paragraph(
  text: string,
  size: number,
  bold: boolean,
  color: [number, number, number],
  gapAfter: number,
  indent = 0,
): Chunk {
  const lines = wrap(plain(text), size, USABLE - indent);
  const items = lines.map((line, index) => ({
    item: { kind: 'text', text: line, size, bold, x: indent, color } as Item,
    dy: index * size * LEADING + size,
  }));
  return { height: lines.length * size * LEADING + gapAfter, items, breakable: true };
}

/* ------------------------------------------------------------- charting -- */

const CHART_LABEL_W = 150;
const CHART_VALUE_W = 76;
const ROW_H = 19;

function barsChunk(block: Extract<Block, { kind: 'bars' }>): Chunk[] {
  const rows = block.rows.slice(0, 14);
  const trackW = USABLE - CHART_LABEL_W - CHART_VALUE_W;
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  const chunks: Chunk[] = [paragraph(block.title, 11.5, true, INK, 3)];
  if (block.note) chunks.push(paragraph(block.note, 9, false, MUTED, 5));

  const items: { item: Item; dy: number }[] = [];
  rows.forEach((row, index) => {
    const top = index * ROW_H;
    const w = Math.max(1.5, (Math.abs(row.value) / max) * trackW);
    items.push({ item: { kind: 'rect', x: CHART_LABEL_W, y: top + 4, w: trackW, h: 9, color: GREY }, dy: 0 });
    items.push({
      item: { kind: 'rect', x: CHART_LABEL_W, y: top + 4, w, h: 9, color: RGB[row.tone ?? 'neutral'] },
      dy: 0,
    });
    items.push({
      item: { kind: 'text', text: row.label.slice(0, 30), size: 8.5, bold: false, x: 0, color: INK },
      dy: top + 11,
    });
    items.push({
      item: {
        kind: 'text',
        text: row.display,
        size: 8.5,
        bold: true,
        x: CHART_LABEL_W + trackW + 6,
        color: INK,
      },
      dy: top + 11,
    });
  });

  chunks.push({ height: rows.length * ROW_H + 12, items, breakable: false });
  return chunks;
}

function divergingChunk(block: Extract<Block, { kind: 'diverging' }>): Chunk[] {
  const rows = block.rows.slice(0, 14);
  const trackW = USABLE - CHART_LABEL_W - CHART_VALUE_W;
  const mid = CHART_LABEL_W + trackW / 2;
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0.01);
  const good = block.positiveIsGood ? RGB.good : RGB.bad;
  const bad = block.positiveIsGood ? RGB.bad : RGB.good;

  const chunks: Chunk[] = [paragraph(block.title, 11.5, true, INK, 3)];
  if (block.note) chunks.push(paragraph(block.note, 9, false, MUTED, 5));

  const items: { item: Item; dy: number }[] = [];
  items.push({
    item: { kind: 'line', x1: mid, y1: 0, x2: mid, y2: rows.length * ROW_H, color: RULE },
    dy: 0,
  });
  rows.forEach((row, index) => {
    const top = index * ROW_H;
    const w = Math.max(1.2, (Math.abs(row.value) / max) * (trackW / 2));
    items.push({
      item: {
        kind: 'rect',
        x: row.value >= 0 ? mid : mid - w,
        y: top + 4,
        w,
        h: 9,
        color: row.value >= 0 ? good : bad,
      },
      dy: 0,
    });
    items.push({
      item: { kind: 'text', text: row.label.slice(0, 30), size: 8.5, bold: false, x: 0, color: INK },
      dy: top + 11,
    });
    items.push({
      item: {
        kind: 'text',
        text: row.display,
        size: 8.5,
        bold: true,
        x: CHART_LABEL_W + trackW + 6,
        color: INK,
      },
      dy: top + 11,
    });
  });

  chunks.push({ height: rows.length * ROW_H + 12, items, breakable: false });
  return chunks;
}

function lineChunk(block: Extract<Block, { kind: 'line' }>): Chunk[] {
  const values = block.points.map((point) => point.value).filter((value): value is number => value !== null);
  if (values.length < 2) return [paragraph(block.title, 11.5, true, INK, 6)];

  const height = 108;
  const left = 52;
  const plotW = USABLE - left - 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const chunks: Chunk[] = [paragraph(block.title, 11.5, true, INK, 3)];
  if (block.note) chunks.push(paragraph(block.note, 9, false, MUTED, 5));

  const items: { item: Item; dy: number }[] = [];
  items.push({ item: { kind: 'line', x1: left, y1: 0, x2: left + plotW, y2: 0, color: RULE }, dy: 0 });
  items.push({ item: { kind: 'line', x1: left, y1: height, x2: left + plotW, y2: height, color: RULE }, dy: 0 });
  items.push({
    item: { kind: 'text', text: block.highLabel, size: 7.5, bold: false, x: 0, color: MUTED },
    dy: 3,
  });
  items.push({
    item: { kind: 'text', text: block.lowLabel, size: 7.5, bold: false, x: 0, color: MUTED },
    dy: height + 3,
  });

  // Straight segments between measured days. A gap breaks the line rather than
  // being bridged, because a bridged gap draws a day nobody measured.
  const x = (index: number) => left + (index / Math.max(1, block.points.length - 1)) * plotW;
  const y = (value: number) => height - ((value - min) / span) * height;
  let previous: { x: number; y: number } | null = null;
  block.points.forEach((point, index) => {
    if (point.value === null) {
      previous = null;
      return;
    }
    const here = { x: x(index), y: y(point.value) };
    if (previous) {
      items.push({
        item: { kind: 'line', x1: previous.x, y1: previous.y, x2: here.x, y2: here.y, color: INK },
        dy: 0,
      });
    }
    previous = here;
  });

  items.push({
    item: { kind: 'text', text: block.points[0]?.label ?? '', size: 7.5, bold: false, x: left, color: MUTED },
    dy: height + 12,
  });

  chunks.push({ height: height + 22, items, breakable: false });
  return chunks;
}

/* ------------------------------------------------------------- assembly -- */

function blockChunks(block: Block): Chunk[] {
  switch (block.kind) {
    case 'heading':
      return [
        { height: 6, items: [], breakable: true },
        paragraph(block.text, block.level === 1 ? 15 : 12.5, true, INK, 5),
      ];
    case 'lede':
      return [paragraph(block.text, 11.5, false, INK, 9)];
    case 'para':
      return [paragraph(block.text, 10, false, INK, 7)];
    case 'callout':
      return [
        paragraph(block.title, 10, true, RGB[block.tone], 2),
        paragraph(block.text, 10, false, INK, 9, 10),
      ];
    case 'list':
      return block.items.map((item) => paragraph(`- ${item}`, 10, false, INK, 3, 8));
    case 'stats':
      return block.items.map((item) =>
        paragraph(`${item.label}: ${item.value}${item.note ? ` (${item.note})` : ''}`, 10, false, INK, 3, 8),
      );
    case 'table': {
      const chunks: Chunk[] = [paragraph(block.columns.join('  |  '), 9, true, INK, 3)];
      for (const row of block.rows) chunks.push(paragraph(row.join('  |  '), 9, false, INK, 2));
      chunks.push({ height: 8, items: [], breakable: true });
      return chunks;
    }
    case 'bars':
      return barsChunk(block);
    case 'diverging':
      return divergingChunk(block);
    case 'line':
      return lineChunk(block);
    case 'rule':
      return [
        {
          height: 16,
          items: [{ item: { kind: 'line', x1: 0, y1: 8, x2: USABLE, y2: 8, color: RULE }, dy: 0 }],
          breakable: true,
        },
      ];
    case 'footnote':
      return [paragraph(block.text, 8.5, false, MUTED, 6)];
  }
}

function contentStream(chunks: { chunk: Chunk; top: number }[]): string {
  const parts: string[] = [];
  let inText = false;

  const endText = () => {
    if (inText) {
      parts.push('ET');
      inText = false;
    }
  };
  const beginText = () => {
    if (!inText) {
      parts.push('BT');
      inText = true;
    }
  };

  for (const { chunk, top } of chunks) {
    for (const { item, dy } of chunk.items) {
      // PDF's origin is bottom-left; the layout above counts downward.
      const baseY = PAGE.height - PAGE.margin - top;
      if (item.kind === 'text') {
        beginText();
        parts.push(`${item.color.map((c) => c.toFixed(3)).join(' ')} rg`);
        parts.push(`${item.bold ? '/F2' : '/F1'} ${item.size} Tf`);
        parts.push(`1 0 0 1 ${(PAGE.margin + item.x).toFixed(2)} ${(baseY - dy).toFixed(2)} Tm`);
        parts.push(`(${pdfText(item.text)}) Tj`);
      } else if (item.kind === 'rect') {
        endText();
        parts.push(`${item.color.map((c) => c.toFixed(3)).join(' ')} rg`);
        parts.push(
          `${(PAGE.margin + item.x).toFixed(2)} ${(baseY - item.y - item.h).toFixed(2)} ` +
            `${item.w.toFixed(2)} ${item.h.toFixed(2)} re f`,
        );
      } else {
        endText();
        parts.push(`${item.color.map((c) => c.toFixed(3)).join(' ')} RG`);
        parts.push('0.8 w');
        parts.push(
          `${(PAGE.margin + item.x1).toFixed(2)} ${(baseY - item.y1).toFixed(2)} m ` +
            `${(PAGE.margin + item.x2).toFixed(2)} ${(baseY - item.y2).toFixed(2)} l S`,
        );
      }
    }
  }

  endText();
  return parts.join('\n');
}

/** A complete, valid PDF with a correct cross-reference table. */
export function toPdf(doc: ReportDoc): Buffer {
  const chunks: Chunk[] = [
    paragraph(doc.title, 20, true, INK, 6),
    ...(doc.subtitle ? [paragraph(doc.subtitle, 11, false, MUTED, 8)] : []),
    ...doc.meta.map((entry) => paragraph(`${entry.label}: ${entry.value}`, 9, false, MUTED, 2)),
    { height: 12, items: [], breakable: true },
    ...doc.blocks.flatMap(blockChunks),
  ];

  const usableHeight = PAGE.height - PAGE.margin * 2;
  const pages: { chunk: Chunk; top: number }[][] = [];
  let page: { chunk: Chunk; top: number }[] = [];
  let used = 0;

  for (const chunk of chunks) {
    // A chart that would straddle a page break moves whole to the next page.
    if (used + chunk.height > usableHeight && page.length) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push({ chunk, top: used });
    used += chunk.height;
  }
  if (page.length) pages.push(page);
  if (!pages.length) pages.push([]);

  const objects: string[] = [];
  const pageIds: number[] = [];
  const firstPageId = 5;
  pages.forEach((_, index) => pageIds.push(firstPageId + index * 2));

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
  );
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  pages.forEach((entries, index) => {
    const contentId = firstPageId + index * 2 + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width.toFixed(2)} ${PAGE.height.toFixed(2)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    const stream = contentStream(entries);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
