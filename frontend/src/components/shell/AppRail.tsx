'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type ComponentType, type SVGProps } from 'react';
import type { Workspace } from '@/contracts';
import { HelmMark } from '@/components/brand/HelmMark';
import {
  IconAudit,
  IconBriefing,
  IconCampaigns,
  IconChevronDown,
  IconConnection,
  IconIntelligence,
  IconLibrary,
  IconEvidence,
  IconRail,
  IconSettings,
  IconSpark,
  IconTeam,
  IconUser,
  IconWarning,
} from '@/components/icons';
import { MenuItem, MenuSection, Popover } from '@/components/primitives/Popover';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

type RailLink = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  /** Only the exact path counts as active — used for the workspace root. */
  exact?: boolean;
  /** Distinguishes sibling links that share a pathname but not a tab. */
  tab?: string;
  /** A number reads as work waiting; a dot reads as a condition to look at. */
  count?: number;
  dot?: 'warn' | 'good';
};

type RailGroup = { label: string | null; links: RailLink[] };

/**
 * Four groups, in the order somebody actually works.
 *
 * Analysis first, then the things they make, then the people, then the
 * platform. Data Sources is deliberately absent: a connector is reached
 * through Integrations, and a raw table of sources is not a destination
 * anybody navigates to on purpose.
 */
export function AppRail({
  workspace,
  workspaces,
  query,
  attentionCount,
  decisionCount,
  user,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  query: string;
  attentionCount: number;
  decisionCount: number;
  user: { name: string; email: string; title: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const currentTab = searchParams.get('tab');

  const groups: RailGroup[] = [
    {
      label: null,
      links: [
        { href: routes.briefing(workspace.slug), label: 'Briefing', icon: IconBriefing, exact: true },
        { href: routes.campaigns(workspace.slug), label: 'Campaigns', icon: IconCampaigns },
        {
          href: routes.intelligence(workspace.slug),
          label: 'Agent Fleet',
          icon: IconIntelligence,
          count: decisionCount,
        },
      ],
    },
    {
      label: 'AI kit',
      links: [
        { href: routes.studio(workspace.slug), label: 'Studio', icon: IconSpark },
        { href: routes.library(workspace.slug), label: 'Assets', icon: IconLibrary, exact: true },
        { href: routes.documents(workspace.slug), label: 'Documents', icon: IconEvidence },
      ],
    },
    {
      label: 'Organization',
      links: [
        { href: routes.settings(workspace.slug, 'team'), label: 'Team', icon: IconTeam, tab: 'team' },
        { href: routes.settings(workspace.slug, 'audit'), label: 'Activity', icon: IconAudit, tab: 'audit' },
      ],
    },
    {
      label: 'Platform',
      links: [
        {
          href: routes.connections(workspace.slug),
          label: 'Integrations',
          icon: IconConnection,
          dot: attentionCount > 0 ? 'warn' : 'good',
        },
        { href: routes.settings(workspace.slug), label: 'Settings', icon: IconSettings },
      ],
    },
  ];

  const isActive = (link: RailLink) => {
    const base = link.href.split('?')[0];
    const onPath = link.exact ? pathname === base : pathname.startsWith(base);
    if (!onPath) return false;
    // Settings still hosts Team and Activity behind one path, so the tab
    // decides which row lights up. Assets and Documents no longer need this:
    // they are separate routes now.
    if (base.endsWith('/settings')) {
      return link.tab ? currentTab === link.tab : currentTab !== 'team' && currentTab !== 'audit';
    }
    // The studio lives under the library path but is its own destination.
    if (base.endsWith('/library') && pathname.startsWith(`${base}/studio`)) return false;
    return true;
  };

  const renderLink = (link: RailLink) => {
    const active = isActive(link);
    const Icon = link.icon;
    const href = link.href.includes('?') ? link.href : `${link.href}${query}`;

    return (
      <li key={link.label}>
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          title={collapsed ? link.label : undefined}
          className={cn(
            'rail-focus group relative flex h-[38px] items-center gap-2.5 rounded-control pl-3 pr-2.5 text-[13.5px] transition-colors duration-[110ms]',
            collapsed && 'justify-center px-0',
            active
              ? 'bg-rail-accent-soft font-semibold text-rail-ink-strong'
              : 'text-rail-muted hover:bg-rail-raised hover:text-rail-ink',
          )}
        >
          {/* Active state is a coordinate rule, not a filled tile. On the dark
              ground the rule is the accent: the one place colour means "here". */}
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-0 top-1/2 h-[18px] w-[2.5px] -translate-y-1/2 rounded-r-full bg-rail-accent transition-opacity duration-[110ms]',
              active ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span className={cn('shrink-0', active ? 'text-rail-accent' : 'text-rail-muted group-hover:text-rail-ink')}>
            <Icon size={17} />
          </span>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
              {link.count ? (
                // Amber fill, dark ink. The accent never carries white text.
                <span className="mono shrink-0 rounded-full bg-rail-accent px-1.5 py-px text-[10.5px] font-medium text-action-ink">
                  {link.count}
                </span>
              ) : null}
              {link.dot ? (
                // The semantic warn and good are mixed for a light card and go
                // muddy on Gray-900, so the dot brightens to hold against it.
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    link.dot === 'warn' ? 'bg-[#fbbf24]' : 'bg-[#34d399]/70',
                  )}
                />
              ) : null}
            </>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-rail-line bg-rail transition-[width] duration-[180ms] ease-out lg:flex',
        collapsed ? 'w-[70px]' : 'w-[228px]',
      )}
      aria-label="Workspace navigation"
    >
      {/* Workspace identity — quieter than the account scope control */}
      <div
        className={cn(
          'flex h-[62px] items-center gap-2.5 border-b border-rail-line px-3',
          collapsed && 'justify-center',
        )}
      >
        <Link
          href={routes.briefing(workspace.slug)}
          aria-label="HELM — Briefing"
          className="rail-focus shrink-0 rounded-control"
        >
          <HelmMark size={26} tone="rail" />
        </Link>
        {!collapsed ? (
          <Popover
            align="start"
            width="w-[268px]"
            label="Switch workspace"
            className="min-w-0 flex-1"
            trigger={({ toggle, open, ref }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-haspopup="dialog"
                className="rail-focus flex w-full items-center gap-1 rounded-control px-1.5 py-1 text-left transition-colors hover:bg-rail-raised"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-rail-ink-strong">
                    {workspace.name}
                  </span>
                  <span className="block truncate text-[11px] text-rail-muted">
                    {workspace.isSample ? 'Sample workspace' : workspace.role === 'owner' ? 'Owner' : workspace.role}
                  </span>
                </span>
                <span className="shrink-0 text-rail-muted">
                  <IconChevronDown size={15} />
                </span>
              </button>
            )}
          >
            {({ close }) => (
              <div>
                <MenuSection label="Workspaces">
                  {workspaces.map((entry) => (
                    <Link
                      key={entry.id}
                      href={routes.briefing(entry.slug)}
                      onClick={close}
                      className={cn(
                        'flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-sunk',
                        entry.slug === workspace.slug && 'bg-helm-50',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-ink-950">{entry.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-400">
                          {entry.role} · {entry.activeAccountCount} ad accounts
                        </span>
                        {entry.attention ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-warn">
                            <IconWarning size={12} />
                            {entry.attention}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ))}
                </MenuSection>
                <MenuSection>
                  <MenuItem onClick={close}>Create a workspace</MenuItem>
                </MenuSection>
              </div>
            )}
          </Popover>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Primary">
        {groups.map((group, index) => (
          <div key={group.label ?? 'primary'} className={cn(index > 0 && (collapsed ? 'mt-4' : 'mt-5'))}>
            {group.label ? (
              collapsed ? (
                <div className="mx-auto mb-3 h-px w-6 bg-rail-line-strong" aria-hidden="true" />
              ) : (
                <p className="mono px-3 pb-1.5 text-[10px] uppercase tracking-[0.14em] text-rail-muted">
                  {group.label}
                </p>
              )
            ) : null}
            <ul className="space-y-px">{group.links.map(renderLink)}</ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-rail-line p-2.5">
        <div className={cn('flex items-center gap-1', collapsed && 'flex-col gap-1.5')}>
          <Popover
            align="start"
            width="w-[248px]"
            label="Account menu"
            placement="top"
            className="min-w-0 flex-1"
            trigger={({ toggle, open, ref }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-haspopup="dialog"
                className={cn(
                  'rail-focus flex h-10 w-full items-center gap-2.5 rounded-control px-2 text-left transition-colors hover:bg-rail-raised',
                  collapsed && 'justify-center px-0',
                )}
              >
                {/* The primary is the rail's own ground here, so the avatar
                    inverts to stay an object rather than a hole in the rail. */}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rail-raised text-[10.5px] font-semibold tracking-[0.02em] text-rail-ink-strong ring-1 ring-rail-line-strong">
                  AR
                </span>
                {!collapsed ? (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-rail-ink-strong">{user.name}</span>
                    <span className="block truncate text-[11px] text-rail-muted">{user.title}</span>
                  </span>
                ) : null}
              </button>
            )}
          >
            {({ close }) => (
              <div>
                <div className="border-b border-line px-3 py-2.5">
                  <p className="text-[13.5px] text-ink-950">{user.name}</p>
                  <p className="mono text-[11.5px] text-ink-400">{user.email}</p>
                </div>
                <MenuSection>
                  <MenuItem onClick={close} leading={<IconUser size={16} />}>
                    Profile and preferences
                  </MenuItem>
                  <MenuItem onClick={close} leading={<IconRail size={16} />}>
                    Keyboard shortcuts
                  </MenuItem>
                </MenuSection>
                <MenuSection>
                  <MenuItem onClick={close}>Sign out</MenuItem>
                </MenuSection>
              </div>
            )}
          </Popover>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="rail-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-rail-muted transition-colors hover:bg-rail-raised hover:text-rail-ink"
          >
            <IconRail size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
