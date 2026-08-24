import Link from 'next/link';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { routes } from '@/lib/routes';

/**
 * No dead links, environment badges, or fake availability indicators.
 * Privacy, Terms and Status appear only once real destinations exist.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-night-line bg-night-950 px-5 py-12 sm:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <HelmWordmark tone="dark" size="sm" subtitle="Paid-media intelligence" />
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
          <a href="#product" className="text-[14px] text-night-muted transition-colors hover:text-night-ink">
            Product
          </a>
          <a href="#method" className="text-[14px] text-night-muted transition-colors hover:text-night-ink">
            Method
          </a>
          <a href="#security" className="text-[14px] text-night-muted transition-colors hover:text-night-ink">
            Security
          </a>
          <Link
            href={routes.signin()}
            className="text-[14px] text-night-muted transition-colors hover:text-night-ink"
          >
            Sign in
          </Link>
        </nav>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1400px] flex-col gap-2 border-t border-night-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="mono text-[11.5px] text-night-faint">© HELM</p>
        <p className="text-[11.5px] text-night-faint">
          Figures shown across this page are an illustrative sample workspace, not customer data.
        </p>
      </div>
    </footer>
  );
}
