import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google';
import './globals.css';

const sans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

const SITE_URL = 'https://helm.example';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HELM — See what moved. Know what to move next.',
    template: '%s · HELM',
  },
  description:
    'HELM reconciles every connected Google Ads and Meta Ads account, finds the decisions hiding in the movement, and shows the evidence before you move budget.',
  applicationName: 'HELM',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'HELM',
    title: 'HELM — See what moved. Know what to move next.',
    description:
      'Paid-media intelligence for Google Ads and Meta Ads. Signal, discrepancy, evidence, recommendation, human decision.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HELM — See what moved. Know what to move next.',
    description: 'Paid-media intelligence for Google Ads and Meta Ads.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#070A12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
