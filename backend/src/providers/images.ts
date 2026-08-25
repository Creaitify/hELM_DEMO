import { createHash } from 'node:crypto';
import { env } from '../env.js';

/**
 * Image generation for the creative studio.
 *
 * Three interchangeable providers behind one call. Which one is live is
 * decided by the environment and reported honestly to the product, so the
 * studio never claims a model produced something a renderer drew.
 *
 * The studio renderer is not a grey placeholder: it composes an art-directed
 * poster in the campaign's own palette from the brief it is given, so the
 * creative surface is demonstrable before any image key exists.
 */

export type GenerateImageInput = {
  prompt: string;
  aspect: '1:1' | '4:5' | '9:16' | '16:9';
  /** Short campaign line placed in the composition. */
  headline?: string;
  subline?: string;
  brand?: string;
  /** Drives palette and layout selection in the studio renderer. */
  direction?: 'product-proof' | 'field-use' | 'typographic' | 'evidence';
  seed?: string;
};

export type GeneratedImage = {
  /** SVG or PNG bytes. */
  data: Buffer;
  contentType: 'image/svg+xml' | 'image/png';
  width: number;
  height: number;
  provider: 'gemini' | 'openai' | 'studio-render';
  model: string;
  revisedPrompt?: string;
  note?: string;
};

const DIMENSIONS: Record<GenerateImageInput['aspect'], { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
};

export function imageProviderName(): GeneratedImage['provider'] {
  if (env.images.provider === 'gemini' && env.images.apiKey) return 'gemini';
  if (env.images.provider === 'openai' && env.images.apiKey) return 'openai';
  return 'studio-render';
}

/** The model name the studio should report, live or otherwise. */
export function imageModelName(): string {
  const provider = imageProviderName();
  if (provider === 'gemini') return env.images.model || env.images.geminiModel;
  if (provider === 'openai') return env.images.model || env.images.openaiModel;
  return 'HELM studio renderer';
}

export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const provider = imageProviderName();
  if (provider === 'gemini') {
    try {
      return await generateWithGemini(input);
    } catch (error) {
      return studioRender(input, `Gemini call failed: ${describe(error)} — rendered locally instead.`);
    }
  }
  if (provider === 'openai') {
    try {
      return await generateWithOpenAI(input);
    } catch (error) {
      return studioRender(input, `OpenAI call failed: ${describe(error)} — rendered locally instead.`);
    }
  }
  return studioRender(input);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------------------------------------- providers -- */

async function generateWithGemini(input: GenerateImageInput): Promise<GeneratedImage> {
  const { width, height } = DIMENSIONS[input.aspect];
  const model = env.images.model || env.images.geminiModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': env.images.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: composePrompt(input) }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: input.aspect } },
    }),
  });

  // Gemini image models are billed-only: an unbilled key answers 429 with
  // 'limit: 0'. That is a configuration fact, not a transient failure, so the
  // studio renderer takes over and the studio says why.
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);

  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const part = body.candidates?.[0]?.content?.parts?.find((entry) => entry.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error('Gemini returned no image data');

  return {
    data: Buffer.from(part.inlineData.data, 'base64'),
    contentType: 'image/png',
    width,
    height,
    provider: 'gemini',
    model,
  };
}

async function generateWithOpenAI(input: GenerateImageInput): Promise<GeneratedImage> {
  const { width, height } = DIMENSIONS[input.aspect];
  const size =
    input.aspect === '1:1' ? '1024x1024' : input.aspect === '16:9' ? '1536x1024' : '1024x1536';

  const model = env.images.model || env.images.openaiModel;
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.images.apiKey}`,
    },
    body: JSON.stringify({ model, prompt: composePrompt(input), size, n: 1 }),
  });

  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);

  const body = (await response.json()) as { data?: { b64_json?: string; revised_prompt?: string }[] };
  const first = body.data?.[0];
  if (!first?.b64_json) throw new Error('OpenAI returned no image data');

  return {
    data: Buffer.from(first.b64_json, 'base64'),
    contentType: 'image/png',
    width,
    height,
    provider: 'openai',
    model,
    revisedPrompt: first.revised_prompt,
  };
}

function composePrompt(input: GenerateImageInput): string {
  const parts = [
    input.prompt,
    input.headline ? `Headline to render in the composition: "${input.headline}".` : '',
    input.subline ? `Supporting line: "${input.subline}".` : '',
    input.brand ? `Brand: ${input.brand}.` : '',
    'Art direction: editorial paid-social still. Graphite, frost, deep cobalt with a single warm coral annotation. Hard crop, low horizon, generous negative space, no stock-photo gloss, no watermark, no lorem text.',
  ];
  return parts.filter(Boolean).join(' ');
}

/* --------------------------------------------------------- studio render -- */

function hashSeed(value: string): number {
  const digest = createHash('sha256').update(value).digest();
  return digest.readUInt32BE(0);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = {
  'product-proof': { base: '#0C2050', deep: '#08132F', lift: '#12306E', ink: '#F2F6FF', muted: '#8DA4CE', accent: '#F7AA8E' },
  'field-use': { base: '#101826', deep: '#070B14', lift: '#1D2C44', ink: '#EEF3FB', muted: '#93A6C4', accent: '#F7AA8E' },
  typographic: { base: '#E8EDF6', deep: '#CFD9EA', lift: '#FFFFFF', ink: '#0A1330', muted: '#5A6C90', accent: '#C8623C' },
  evidence: { base: '#0A1330', deep: '#050A1C', lift: '#16255A', ink: '#EAF0FF', muted: '#8698C4', accent: '#7FA0E8' },
} as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wraps a headline onto at most three lines at roughly `perLine` characters. */
function wrap(text: string, perLine: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= perLine) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

/**
 * Draws the brief rather than illustrating nothing: a cobalt field, a lit
 * product silhouette or measurement grid depending on the direction, the
 * headline set as the composition's subject, and one coral annotation rule.
 */
function studioRender(input: GenerateImageInput, note?: string): GeneratedImage {
  const { width, height } = DIMENSIONS[input.aspect];
  const direction = input.direction ?? 'product-proof';
  const palette = PALETTES[direction];
  const random = mulberry32(hashSeed(input.seed ?? input.prompt));

  const headline = (input.headline ?? input.prompt).slice(0, 90);
  const margin = Math.round(width * 0.075);
  const headlineSize = Math.round(width * (input.aspect === '9:16' ? 0.085 : 0.095));
  const lines = wrap(headline.toUpperCase(), input.aspect === '16:9' ? 22 : 16);

  const bottleScale = (height * 0.62) / 240;
  const bottleX = width * 0.42;
  const bottleY = height * 0.3;

  const droplets = Array.from({ length: 14 }, () => ({
    cx: 18 + random() * 60,
    cy: 40 + random() * 190,
    r: 1.4 + random() * 2.4,
  }));

  const gridLines = Array.from({ length: 9 }, (_, index) => margin + ((width - margin * 2) / 8) * index);

  const productLayer = `
    <g transform="translate(${bottleX} ${bottleY}) scale(${bottleScale.toFixed(3)})">
      <path d="M38 2h24a4 4 0 0 1 4 4v12H34V6a4 4 0 0 1 4-4Z" fill="url(#glass)" />
      <path d="M40 20h20c0 10 22 12 22 34v176a20 20 0 0 1-20 20H38a20 20 0 0 1-20-20V54c0-22 22-24 22-34Z" fill="url(#glass)" />
      ${droplets
        .map((drop) => `<circle cx="${drop.cx.toFixed(1)}" cy="${drop.cy.toFixed(1)}" r="${drop.r.toFixed(1)}" fill="#FFFFFF" opacity="0.45" />`)
        .join('')}
    </g>`;

  const evidenceLayer = `
    <g opacity="0.5">
      ${gridLines
        .map((x) => `<line x1="${x.toFixed(1)}" y1="${margin}" x2="${x.toFixed(1)}" y2="${height - margin}" stroke="${palette.muted}" stroke-opacity="0.18" stroke-width="1" />`)
        .join('')}
      <polyline points="${gridLines
        .map((x, index) => `${x.toFixed(1)},${(height * 0.62 - Math.sin(index * 0.9 + random()) * height * 0.06).toFixed(1)}`)
        .join(' ')}" fill="none" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round" />
    </g>`;

  const typographicLayer = `
    <g opacity="0.9">
      <circle cx="${width - margin - width * 0.16}" cy="${height * 0.3}" r="${width * 0.15}" fill="none" stroke="${palette.accent}" stroke-width="2" />
      <circle cx="${width - margin - width * 0.16}" cy="${height * 0.3}" r="${width * 0.1}" fill="none" stroke="${palette.muted}" stroke-width="1" stroke-opacity="0.6" />
    </g>`;

  const subject =
    direction === 'evidence'
      ? evidenceLayer
      : direction === 'typographic'
        ? typographicLayer
        : productLayer;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(headline)}">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.lift}" />
      <stop offset="55%" stop-color="${palette.base}" />
      <stop offset="100%" stop-color="${palette.deep}" />
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#DCE8FF" stop-opacity="0.95" />
      <stop offset="45%" stop-color="#9DB4DE" stop-opacity="0.88" />
      <stop offset="100%" stop-color="#3E5686" stop-opacity="0.9" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#field)" />
  <rect x="0" y="0" width="${(width * 0.34).toFixed(0)}" height="${height}" fill="#FFFFFF" opacity="0.04" />
  ${subject}
  <g font-family="Instrument Sans, Segoe UI, Helvetica, Arial, sans-serif">
    ${lines
      .map(
        (line, index) =>
          `<text x="${margin}" y="${margin + headlineSize * (index + 1)}" fill="${index === lines.length - 1 ? palette.accent : palette.ink}" font-size="${headlineSize}" font-weight="700" letter-spacing="-0.02em">${escapeXml(line)}</text>`,
      )
      .join('\n    ')}
    <rect x="${margin}" y="${margin + headlineSize * lines.length + headlineSize * 0.4}" width="${(width * 0.11).toFixed(0)}" height="${Math.max(3, Math.round(width * 0.004))}" fill="${palette.accent}" />
    ${
      input.subline
        ? `<text x="${margin}" y="${margin + headlineSize * lines.length + headlineSize * 1.35}" fill="${palette.muted}" font-size="${Math.round(headlineSize * 0.34)}" letter-spacing="0.01em">${escapeXml(input.subline.slice(0, 64))}</text>`
        : ''
    }
    <text x="${margin}" y="${height - margin}" fill="${palette.muted}" font-size="${Math.round(width * 0.019)}" letter-spacing="0.14em" font-family="IBM Plex Mono, Consolas, monospace">${escapeXml((input.brand ?? 'HELM STUDIO').toUpperCase())}</text>
    <text x="${width - margin}" y="${height - margin}" text-anchor="end" fill="${palette.muted}" font-size="${Math.round(width * 0.016)}" letter-spacing="0.1em" font-family="IBM Plex Mono, Consolas, monospace">${input.aspect} · ${width}×${height}</text>
  </g>
</svg>`;

  return {
    data: Buffer.from(svg, 'utf8'),
    contentType: 'image/svg+xml',
    width,
    height,
    provider: 'studio-render',
    model: 'HELM studio renderer',
    note:
      note ??
      'Rendered by the HELM studio renderer. Set IMAGE_PROVIDER and IMAGE_API_KEY to generate with a model.',
  };
}
