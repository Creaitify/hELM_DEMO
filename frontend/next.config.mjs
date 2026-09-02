/** @type {import('next').NextConfig} */

/**
 * Static export, for GitHub Pages.
 *
 * `output: 'export'` writes plain HTML/CSS/JS and no server. That removes the
 * two things this config used to do:
 *
 *   rewrites() proxied /api to the backend. There is no server to proxy with,
 *   so every /api call from the exported site goes to the Pages host and 404s.
 *
 *   headers() set Referrer-Policy, X-Content-Type-Options, X-Frame-Options and
 *   Permissions-Policy. Headers come from the server too; Pages serves its own
 *   and there is no hook to add these. They are gone, not relocated.
 *
 * Both were load-bearing. The exported site is a look at the product, not the
 * product: anything that reads the API renders from the sample fixtures the
 * pages already fall back to, and the agent console cannot answer at all.
 */
const nextConfig = {
  output: 'export',
  basePath: '/hELM_DEMO',
  assetPrefix: '/hELM_DEMO/',
  reactStrictMode: true,
  /*
   * Where the build output goes.
   *
   * Defaults to .next, so nothing changes for a normal `npm run dev`. It is
   * overridable because two dev servers started from this directory share one
   * output folder and quietly corrupt each other's chunks — the symptom is a
   * module that throws ReferenceError for something it plainly imports, or a
   * route that 404s while its file sits right there. Give a second server its
   * own directory (NEXT_DIST_DIR=.next-review npm run dev -- -p 3100) and the
   * whole class of ghost goes away.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  experimental: {
    /*
     * Route changes run through document.startViewTransition, so the browser
     * holds a snapshot of the outgoing page and cross-fades it against the
     * incoming one. The pairing is named in motion.css: the rail and the scope
     * bar keep their identity and stay put, and only the content region
     * animates. That is the difference between a tab switch and a reload.
     *
     * Browsers without the API navigate exactly as before; the content still
     * settles on arrival via .route-frame, so the fallback is a shorter
     * version of the same idea rather than a hard cut.
     */
    viewTransition: true,
  },
  // A screenshot or smoke run reaching the dev server over 127.0.0.1 rather
  // than localhost is the same machine; without this Next warns about it.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
