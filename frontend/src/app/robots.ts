import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const SITE_URL = 'https://helm.example';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/w/', '/signin', '/onboarding', '/ops', '/app'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
