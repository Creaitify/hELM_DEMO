/** @type {import('next').NextConfig} */

/**
 * The browser only ever calls same-origin /api. This rewrite forwards those
 * paths to the private API origin, so the session cookie belongs to the public
 * origin, provider tokens never leave the server side, and no page has to know
 * where the backend lives.
 */
const API_ORIGIN = process.env.HELM_API_ORIGIN ?? 'http://localhost:8100';

const nextConfig = {
  reactStrictMode: true,
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
