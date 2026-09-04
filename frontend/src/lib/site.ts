/**
 * The public origin this build will be served from.
 *
 * Absolute URLs are baked in at build time — canonical links, Open Graph
 * tags, robots' sitemap pointer and the sitemap itself all have to name a
 * real origin, and a static export has no request to infer one from. The
 * placeholder is fine for a server build behind its own domain, but a Pages
 * deploy that ships it tells crawlers the canonical copy of every page lives
 * on a domain that does not exist.
 *
 * Set HELM_SITE_URL to the origin plus any base path (the Pages workflow
 * passes https://<owner>.github.io/<repo>). Read at build time only, so it
 * needs no NEXT_PUBLIC_ prefix.
 */
export const SITE_URL = (process.env.HELM_SITE_URL ?? 'https://helm.example').replace(/\/+$/, '');
