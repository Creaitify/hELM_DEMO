/**
 * Documents, in the formats people actually have to hand them over in.
 *
 * A decision the product asked somebody to make has to leave the product — into
 * a board pack, an email, a shared drive. Markdown, HTML, JSON and CSV already
 * covered writing, reading and anything downstream. PDF and Word cover the two
 * that a finance or leadership audience asks for by name.
 *
 * Both are written by hand rather than pulled in as dependencies. A headless
 * browser to print one memo is a hundred megabytes and a sandbox to manage, and
 * a .docx writer is a zip container plus four XML schemas. The alternatives
 * below are small, produce genuinely valid files, and have no supply chain.
 */

/* ------------------------------------------------------------------ word -- */

/**
 * Word opens HTML that declares itself as a Word document, and has since
 * Office 2000. The result is a real editable document with styles intact — not
 * a renamed .html that throws a warning dialog on open.
 */
export function toWordDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2.2cm; }
  body { font-family: Calibri, 'Segoe UI', sans-serif; font-size: 11pt; color: #14171F; line-height: 1.45; }
  h1 { font-size: 20pt; margin: 0 0 4pt; }
  h2 { font-size: 14pt; margin: 18pt 0 4pt; border-bottom: 1px solid #C9D1E0; padding-bottom: 3pt; }
  h3 { font-size: 12pt; margin: 12pt 0 3pt; }
  p, li { margin: 0 0 6pt; }
  code { font-family: Consolas, monospace; font-size: 10pt; }
  .meta { color: #5A6C90; font-size: 9.5pt; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/* ------------------------------------------------------------------- pdf -- */

type Line = { text: string; size: number; bold: boolean; gap: number };

const PAGE = { width: 595.28, height: 841.89, margin: 56 }; // A4 at 72dpi
const LEADING = 1.35;

/**
 * PDF strings escape three characters and nothing else, and the standard
 * fonts are WinAnsi — so anything outside that range is transliterated rather
 * than written as a byte the viewer will render as garbage.
 */
function pdfText(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/₹/g, 'INR ')
    .replace(/×/g, 'x')
    .replace(/·/g, '-')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/** Helvetica's average advance is close enough to wrap on without metrics. */
function wrapToWidth(text: string, size: number, width: number): string[] {
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

/**
 * Turns the Markdown the memo builder already produces into laid-out lines.
 *
 * This reads the small subset the memos actually use — headings, list items,
 * bold runs and paragraphs — rather than pretending to be a Markdown parser.
 */
function layout(markdown: string): Line[] {
  const usable = PAGE.width - PAGE.margin * 2;
  const lines: Line[] = [];

  for (const raw of markdown.split('\n')) {
    const source = raw.replace(/\s+$/, '');
    if (!source.trim()) {
      lines.push({ text: '', size: 10, bold: false, gap: 6 });
      continue;
    }

    let size = 10.5;
    let bold = false;
    let gap = 2;
    let body = source;

    if (source.startsWith('### ')) {
      body = source.slice(4);
      size = 12;
      bold = true;
      gap = 8;
    } else if (source.startsWith('## ')) {
      body = source.slice(3);
      size = 14;
      bold = true;
      gap = 12;
    } else if (source.startsWith('# ')) {
      body = source.slice(2);
      size = 19;
      bold = true;
      gap = 14;
    } else if (source.startsWith('- ')) {
      body = `• ${source.slice(2)}`;
    }

    // Bold runs cannot be mixed inside a line without font switching mid-show,
    // so the markers are dropped and the text keeps its meaning.
    body = body.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');

    const wrapped = wrapToWidth(body, size, usable);
    wrapped.forEach((line, index) => {
      lines.push({ text: line, size, bold, gap: index === 0 ? gap : 0 });
    });
  }

  return lines;
}

/** Splits laid-out lines into pages that fit the text box. */
function paginate(lines: Line[]): Line[][] {
  const usableHeight = PAGE.height - PAGE.margin * 2;
  const pages: Line[][] = [];
  let page: Line[] = [];
  let used = 0;

  for (const line of lines) {
    const height = line.size * LEADING + line.gap;
    if (used + height > usableHeight && page.length) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(line);
    used += height;
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

function contentStream(page: Line[]): string {
  let cursor = PAGE.height - PAGE.margin;
  const parts: string[] = ['BT'];
  let font = '';

  for (const line of page) {
    cursor -= line.size * LEADING + line.gap;
    if (!line.text) continue;

    const wanted = line.bold ? '/F2' : '/F1';
    if (wanted !== font) {
      font = wanted;
      parts.push(`${wanted} ${line.size} Tf`);
    } else {
      parts.push(`${wanted} ${line.size} Tf`);
    }
    parts.push('1 0 0 1 ' + PAGE.margin.toFixed(2) + ' ' + cursor.toFixed(2) + ' Tm');
    parts.push(`(${pdfText(line.text)}) Tj`);
  }

  parts.push('ET');
  return parts.join('\n');
}

/**
 * A complete, valid PDF: catalog, page tree, two standard fonts and one
 * content stream per page, with a correct cross-reference table.
 */
export function toPdf(markdown: string): Buffer {
  const pages = paginate(layout(markdown));

  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  // 1 catalog, 2 page tree, 3 regular font, 4 bold font, then page/content pairs.
  const firstPageId = 5;
  pages.forEach((_, index) => pageObjectIds.push(firstPageId + index * 2));

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
  );
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  pages.forEach((page, index) => {
    const contentId = firstPageId + index * 2 + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width.toFixed(2)} ${PAGE.height.toFixed(2)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    const stream = contentStream(page);
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
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

/* ------------------------------------------------------------- markdown -- */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The same narrow subset of Markdown the memos are written in, as HTML.
 * Shared by the HTML download and the Word document, so the two never drift.
 */
export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let inList = false;

  const inline = (value: string) =>
    escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\s+$/, '');

    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (inList) {
      out.push('</ul>');
      inList = false;
    }

    if (!line.trim()) continue;
    if (line.startsWith('### ')) out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith('## ')) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else out.push(`<p>${inline(line)}</p>`);
  }

  if (inList) out.push('</ul>');
  return out.join('\n');
}
