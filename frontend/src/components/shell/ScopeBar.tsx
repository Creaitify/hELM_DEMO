'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AccountGroup, AccountScope, AdAccount, Workspace } from '@/contracts';
import { AccountScopeCommand } from '@/components/scope/AccountScopeCommand';
import { MenuItem, MenuSection, Popover } from '@/components/primitives/Popover';
import { IconCalendar, IconChevronDown, IconCommand, IconCompare, IconFreshness } from '@/components/icons';
import { cn } from '@/lib/cn';

const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'mtd', label: 'Month to date' },
];

const COMPARISONS = [
  { value: 'previous', label: 'Previous period' },
  { value: 'previous_year', label: 'Same period last year' },
  { value: 'none', label: 'No comparison' },
];

/**
 * The scope bar answers four questions without opening anything: which
 * workspace, which accounts, which period, and how fresh the data is.
 */
export function ScopeBar({
  workspace,
  accounts,
  scopes,
  groups,
  recentScopeIds,
  scopeId,
  range,
  compare,
  freshnessLabel,
  nowIso,
  onOpenCommand,
}: {
  workspace: Workspace;
  accounts: AdAccount[];
  scopes: AccountScope[];
  groups: AccountGroup[];
  recentScopeIds: string[];
  scopeId: string;
  range: string;
  compare: string;
  freshnessLabel: string;
  nowIso: string;
  onOpenCommand: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  const rangeLabel = RANGES.find((entry) => entry.value === range)?.label ?? 'Last 30 days';
  const compareLabel = COMPARISONS.find((entry) => entry.value === compare)?.label ?? 'Previous period';

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-surface/94 backdrop-blur-md">
      <div className="flex min-h-[62px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <AccountScopeCommand
          accounts={accounts}
          scopes={scopes}
          groups={groups}
          recentScopeIds={recentScopeIds}
          currentScopeId={scopeId}
          nowIso={nowIso}
          workspaceSlug={workspace.slug}
        />

        <ScopeMenu
          label={rangeLabel}
          icon={<IconCalendar size={16} />}
          options={RANGES}
          value={range}
          onSelect={(value) => setParam('range', value)}
          menuLabel="Date range"
        />

        <ScopeMenu
          label={`Compare: ${compareLabel.toLowerCase()}`}
          icon={<IconCompare size={16} />}
          options={COMPARISONS}
          value={compare}
          onSelect={(value) => setParam('compare', value)}
          menuLabel="Comparison"
          className="hidden sm:flex"
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCommand}
            className="hidden h-10 items-center gap-2 rounded-control border border-line px-3 text-[13px] text-ink-500 transition-colors hover:border-line-strong hover:text-ink-950 md:flex"
          >
            <IconCommand size={15} />
            <span>Investigate</span>
            <span className="mono rounded border border-line px-1.5 py-0.5 text-[10.5px] text-ink-400">⌘K</span>
          </button>

          <span className="mono inline-flex shrink-0 items-center gap-1.5 text-[11.5px] text-ink-400">
            <IconFreshness size={14} />
            {freshnessLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function ScopeMenu({
  label,
  icon,
  options,
  value,
  onSelect,
  menuLabel,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  menuLabel: string;
  className?: string;
}) {
  return (
    <Popover
      align="start"
      width="w-[236px]"
      label={menuLabel}
      className={className}
      trigger={({ toggle, open, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="flex h-10 shrink-0 items-center gap-2 rounded-control border border-line px-3 text-[13px] text-ink-700 transition-colors duration-[110ms] hover:border-line-strong hover:bg-surface-subtle"
        >
          <span className="text-ink-400">{icon}</span>
          <span className="truncate">{label}</span>
          <span className="text-ink-400">
            <IconChevronDown size={15} />
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <MenuSection label={menuLabel}>
          {options.map((option) => (
            <MenuItem
              key={option.value}
              selected={option.value === value}
              onClick={() => {
                onSelect(option.value);
                close();
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </MenuSection>
      )}
    </Popover>
  );
}

export function MobileNavigation({ workspaceSlug, query }: { workspaceSlug: string; query: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/w/${workspaceSlug}`, label: 'Briefing', exact: true },
    { href: `/w/${workspaceSlug}/campaigns`, label: 'Campaigns' },
    { href: `/w/${workspaceSlug}/intelligence`, label: 'Intelligence' },
    { href: `/w/${workspaceSlug}/library`, label: 'Library' },
  ];

  return (
    <nav
      aria-label="Primary"
      className="safe-b sticky bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/96 backdrop-blur-md lg:hidden"
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.label}
            href={`${item.href}${query}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-14 flex-col items-center justify-center gap-1 text-[11.5px] transition-colors',
              active ? 'font-semibold text-ink-950' : 'text-ink-500',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('h-[2px] w-6 rounded-full', active ? 'bg-helm-500' : 'bg-transparent')}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
