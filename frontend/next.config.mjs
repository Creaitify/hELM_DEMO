/** @type {import('next').NextConfig} */

/**
 * The browser only ever calls same-origin /api. This rewrite forwards those
 * paths to the private API origin, so the session cookie belongs to the public
 * origin, provider tokens never leave the server side, and no page has to know
 * where the backend lives.
 */
const API_ORIGIN = process.env.HELM_API_ORIGIN ?? 'http://localhost:8100';

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
};

export default nextConfig;
