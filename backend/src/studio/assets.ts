import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeneratedImage } from '../providers/images.js';

/**
 * Generated-asset store.
 *
 * Studio output is written to disk under a content-addressed name and served
 * back through /api/studio/assets/:id. Artifacts hold the path, never the
 * bytes, so a library listing stays small and an image can be replaced without
 * rewriting the graph.
 */

const here = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = resolve(here, '../../.data/assets');

const EXTENSION: Record<GeneratedImage['contentType'], string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
};

export type StoredAsset = {
  id: string;
  url: string;
  contentType: GeneratedImage['contentType'];
  width: number;
  height: number;
  provider: GeneratedImage['provider'];
  model: string;
  bytes: number;
  note?: string;
};

export async function storeStudioAsset(image: GeneratedImage): Promise<StoredAsset> {
  await mkdir(ASSET_DIR, { recursive: true });
  const digest = createHash('sha256').update(image.data).digest('hex').slice(0, 24);
  const id = `${digest}.${EXTENSION[image.contentType]}`;
  await writeFile(join(ASSET_DIR, id), image.data);
  return {
    id,
    url: `/api/studio/assets/${id}`,
    contentType: image.contentType,
    width: image.width,
    height: image.height,
    provider: image.provider,
    model: image.model,
    bytes: image.data.byteLength,
    note: image.note,
  };
}

/** Rejects anything that is not a plain content-addressed asset name. */
export function isValidAssetId(id: string): boolean {
  return /^[0-9a-f]{24}\.(svg|png)$/.test(id);
}

export async function readStudioAsset(
  id: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isValidAssetId(id)) return null;
  const path = join(ASSET_DIR, id);
  try {
    await stat(path);
  } catch {
    return null;
  }
  const data = await readFile(path);
  return { data, contentType: id.endsWith('.svg') ? 'image/svg+xml' : 'image/png' };
}
