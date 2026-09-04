import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Static export has no server to generate this per request, so it is emitted
 * once at build time. Without the marker the export fails outright.
 */
export const dynamic = 'force-static';


export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
  ];
}
