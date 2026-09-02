/** @type {import('next').NextConfig} */

/**
 * Two builds come out of this file, and they are not the same product.
 *
 * The server build is the product: a Next server that proxies /api to the
 * backend and sets its own security headers. `npm run dev`, `npm start` and
 * the Vercel deploy are all this build.
 *
 * The static export is a look at the product. GitHub Pages serves files and
 * nothing else, so there is no server to proxy with and no hook to add headers
 * — anything reading the API renders from the sample fixtures the pages
 * already fall back to, and the agent console cannot answer at all.
 *
 * These were previously one config. Exporting unconditionally meant the dev
 * server also lost the /api proxy and answered 404 at its own root, so running
 * the thing locally was broken in service of publishing a demo of it. The
 * switch is opt-in: only the Pages workflow sets it.
 */
const isExport = process.env.HELM_STATIC_EXPORT === 'true';

/**
 * A project Pages site is served from /<repo>, so every asset and route needs
 * that prefix baked in at build time. It is a property of where this is being
 * published, not of the app, which is why it comes from the environment and
 * defaults to the repository this workflow publishes to.
 *
 * Empty for the server build. A basePath there would move the whole app off
 * the origin root for no reason.
 */
const basePath = isExport ? (process.env.HELM_BASE_PATH ?? '/hELM_DEMO') : '';

/**
 * The browser only ever calls same-origin /api. This rewrite forwards those
 * paths to the private API origin, so the session cookie belongs to the public
 * origin, provider tokens never leave the server side, and no page has to know
 * where the backend lives.
 */
const API_ORIGIN = process.env.HELM_API_ORIGIN ?? 'http://localhost:8100';

const nextConfig = {
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

  ...(isExport
    ? {
        output: 'export',
        basePath,
        assetPrefix: `${basePath}/`,
        /*
         * Export a directory per route, not a sibling .html file.
         *
         * Without this, /w/northstar-group resolves (Pages serves
         * northstar-group.html for it) but /w/northstar-group/ does not —
         * there is no directory for it to find an index in, so a trailing
         * slash 404s. People paste URLs with trailing slashes constantly.
         * Writing index.html into a directory makes both spellings work.
         */
        trailingSlash: true,
      }
    : {
        async rewrites() {
          return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
        },
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
