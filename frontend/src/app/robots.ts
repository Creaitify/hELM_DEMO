import type { MetadataRoute } from 'next';

/**
 * Static export has no server to generate this per request, so it is emitted
 * once at build time. Without the marker the export fails outright.
 */
export const dynamic = 'force-static';

const SITE_URL = 'https://helm.example';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/w/', '/signin', '/onboarding', '/ops', '/app'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
