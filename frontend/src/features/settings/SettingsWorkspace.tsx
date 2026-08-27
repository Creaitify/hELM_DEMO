'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AuditEntry, BrandKit, Connection, Member, Role, UserPreference, Workspace } from '@/contracts';
import { Button } from '@/components/primitives/Button';
import { Select, Tabs, TextField } from '@/components/primitives/Controls';
import { ConnectionBadge, StatusBadge } from '@/components/primitives/Status';
import { PermissionState } from '@/components/primitives/States';
import { IconArrowRight, IconLock, ProviderMark, providerLabel } from '@/components/icons';
import { api, describeError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { BrandKitEditor } from './BrandKitEditor';

const ROLE_LABEL: Record<Member['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

/** One settings route with internal tabs. Ledger rows, not a page of cards. */
export function SettingsWorkspace({
  workspace,
  members,
  connections,
  audit,
  preferences,
  workspaceSlug,
  brandKits,
  canEditBrand,
  initialTab,
  nowIso,
  canManageMembers = false,
  assignableRoles = [],
  roleMatrix = [],
  currentUserId,
  live = false,
}: {
  workspace: Workspace;
  members: Member[];
  connections: Connection[];
  audit: AuditEntry[];
  preferences: UserPreference;
  workspaceSlug: string;
  brandKits: BrandKit[];
  canEditBrand: boolean;
  initialTab?: string;
  nowIso: string;
  /** Changing a role or removing access is an admin or owner permission. */
  canManageMembers?: boolean;
  /** Roles the caller's own role is allowed to hand out. */
  assignableRoles?: Role[];
  roleMatrix?: { role: Role; label: string; permissions: string[] }[];
  currentUserId?: string;
  live?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab ?? 'workspace');
  const [name, setName] = useState(workspace.name);
  const [prefs, setPrefs] = useState(preferences);
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busyMember, setBusyMember] = useState<string | null>(null);

  /**
   * Role changes are enforced by the backend, which is the authority. The
   * control here only makes the rule legible: a role the caller cannot assign
   * is not offered, and the backend refuses it anyway.
   */
  const changeRole = async (member: Member, role: Role) => {
    setBusyMember(member.id);
    setProblem(null);
    try {
      await api.patch(`/api/workspaces/${workspaceSlug}/members/${member.id}`, { role });
      setSaved(`${member.name} is now a ${role}.`);
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setBusyMember(null);
    }
  };

  const removeMember = async (member: Member) => {
    setBusyMember(member.id);
    setProblem(null);
    try {
      await api.del(`/api/workspaces/${workspaceSlug}/members/${member.id}`);
      setSaved(`${member.name} no longer has access to ${workspace.name}.`);
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setBusyMember(null);
    }
  };

  return (
    <div>
      <Tabs
        label="Settings sections"
        value={tab}
        onChange={setTab}
        className="border-b border-line"
        options={[
          { value: 'workspace', label: 'Workspace' },
          { value: 'team', label: 'Team', count: members.length },
          { value: 'connections', label: 'Connections' },
          { value: 'brand', label: 'Brand' },
          { value: 'preferences', label: 'Preferences' },
          { value: 'audit', label: 'Audit', count: audit.length },
        ]}
      />

      <div aria-live="polite" className="min-h-[24px]">
        {saved ? <p className="mt-4 text-[13px] text-good">{saved}</p> : null}
      </div>

      <div className="mt-4">
        {tab === 'workspace' ? (
          <div className="max-w-prose space-y-5">
            <Row label="Workspace name" description="Shown in the rail, the scope bar and every export.">
              <TextField
                label="Workspace name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="max-w-[340px]"
              />
            </Row>
            <Row label="Workspace address" description="The slug is immutable. Links you have shared keep working.">
              <p className="mono rounded-control bg-surface-sunk px-3 py-2.5 text-[13px] text-ink-500">
                /w/{workspace.slug}
              </p>
            </Row>
            <Row label="Display currency" description="Used for blended totals when every account agrees.">
              <Select
                label="Display currency"
                hideLabel
                value={workspace.defaultCurrency}
                onChange={() => undefined}
                options={[
                  { value: 'INR', label: 'INR — Indian rupee' },
                  { value: 'USD', label: 'USD — US dollar' },
                  { value: 'GBP', label: 'GBP — Pound sterling' },
                ]}
                className="max-w-[260px]"
              />
            </Row>
            <Row label="Reporting timezone" description="Complete-day ranges are computed in each account's own reporting timezone.">
              <p className="mono rounded-control bg-surface-sunk px-3 py-2.5 text-[13px] text-ink-500">
                {workspace.timeZone}
              </p>
            </Row>
            <Row label="Sample workspace" description="Clearly labelled everywhere so sample figures are never mistaken for customer data.">
              <StatusBadge tone="info">Sample mode is on</StatusBadge>
            </Row>
            <div className="flex gap-2 border-t border-line pt-5">
              <Button variant="action" onClick={() => setSaved('Workspace settings saved.')}>
                Save workspace
              </Button>
              <Button variant="quiet" onClick={() => setName(workspace.name)}>
                Reset
              </Button>
            </div>
          </div>
        ) : null}

        {tab === 'team' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-ink-500">
                {members.filter((m) => m.status === 'active').length} active members ·{' '}
                {members.filter((m) => m.status === 'invited').length} pending invitation
              </p>
              <Button
                variant="indigo"
                size="compact"
                disabled={!canManageMembers}
                onClick={() => setSaved('Invitation sent.')}
              >
                Invite a member
              </Button>
            </div>
            <ul className="s-panel divide-y divide-line p-0">
              {members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 sm:px-6">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-helm-100 text-[12px] font-semibold text-helm-600">
                    {member.name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] text-ink-950">{member.name}</span>
                    <span className="mono block truncate text-[11.5px] text-ink-400">{member.email}</span>
                  </span>
                  {member.status === 'invited' ? <StatusBadge tone="warn">Invitation pending</StatusBadge> : null}
                  {canManageMembers && live && assignableRoles.includes(member.role) ? (
                    <span className="w-[128px] shrink-0">
                      <label className="sr-only" htmlFor={`role-${member.id}`}>
                        Role for {member.name}
                      </label>
                      <select
                        id={`role-${member.id}`}
                        value={member.role}
                        disabled={busyMember === member.id}
                        onChange={(event) => void changeRole(member, event.target.value as Role)}
                        className="h-9 w-full rounded-control border border-line bg-surface px-2 text-[13px] text-ink-950 outline-none focus:border-helm-500"
                      >
                        {assignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                    </span>
                  ) : (
                    <span className="w-[92px] shrink-0 text-[13px] text-ink-700">{ROLE_LABEL[member.role]}</span>
                  )}
                  <span className="mono w-[104px] shrink-0 text-right text-[11.5px] text-ink-400">
                    {formatRelative(member.lastActive, nowIso)}
                  </span>
                  {canManageMembers && live && member.id !== currentUserId ? (
                    <button
                      type="button"
                      disabled={busyMember === member.id}
                      onClick={() => void removeMember(member)}
                      className="shrink-0 text-[12.5px] text-ink-400 transition-colors hover:text-bad"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <div aria-live="polite">
              {problem ? <p className="text-[13px] text-bad">{problem}</p> : null}
            </div>

            {canManageMembers ? null : (
              <PermissionState
                what="Only owners and admins can change roles or remove members."
                who={`Your role in ${workspace.name} is ${ROLE_LABEL[workspace.role]}.`}
              />
            )}

            {/* What each role can actually do, resolved by the backend */}
            {roleMatrix.length ? (
              <div className="s-panel-subtle px-5 py-5">
                <p className="micro-label">What each role can do</p>
                <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {roleMatrix.map((entry) => (
                    <li key={entry.role}>
                      <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink-950">
                        {entry.label}
                        {entry.role === workspace.role ? <StatusBadge tone="info">You</StatusBadge> : null}
                      </p>
                      <ul className="mono mt-1.5 space-y-0.5 text-[11px] text-ink-500">
                        {entry.permissions.map((permission) => (
                          <li key={permission}>{permission}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                <p className="mono mt-4 flex items-center gap-2 border-t border-line pt-3 text-[11px] text-ink-400">
                  <IconLock size={13} />
                  The backend enforces every one of these. Hiding a control is never the enforcement.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'connections' ? (
          <div className="space-y-5">
            <ul className="s-panel divide-y divide-line p-0">
              {connections.map((connection) => (
                <li key={connection.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 sm:px-6">
                  <ProviderMark provider={connection.provider} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] text-ink-950">{providerLabel(connection.provider)}</span>
                    <span className="mono block truncate text-[11.5px] text-ink-400">
                      {connection.identityLabel}
                    </span>
                  </span>
                  <ConnectionBadge status={connection.status} />
                  <span className="mono w-[104px] shrink-0 text-right text-[11.5px] text-ink-400">
                    {formatRelative(connection.lastSyncAt, nowIso)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href={routes.connections(workspaceSlug)}
              className="inline-flex items-center gap-1.5 text-[14px] text-helm-600 hover:underline"
            >
              Open the full connection ledger
              <IconArrowRight size={15} />
            </Link>
          </div>
        ) : null}

        {tab === 'preferences' ? (
          <div className="max-w-prose space-y-5">
            <Row label="Locale" description="Controls number, date and currency formatting.">
              <Select
                label="Locale"
                hideLabel
                value={prefs.locale}
                onChange={(value) => setPrefs({ ...prefs, locale: value })}
                options={[
                  { value: 'en-IN', label: 'English (India)' },
                  { value: 'en-GB', label: 'English (United Kingdom)' },
                  { value: 'en-US', label: 'English (United States)' },
                ]}
                className="max-w-[260px]"
              />
            </Row>
            <Row label="Number format" description="Compact shows ₹39.6L. Exact shows ₹39,59,000.">
              <Select
                label="Number format"
                hideLabel
                value={prefs.numberFormat}
                onChange={(value) => setPrefs({ ...prefs, numberFormat: value as UserPreference['numberFormat'] })}
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'exact', label: 'Exact' },
                ]}
                className="max-w-[260px]"
              />
            </Row>
            <Row label="Week starts on" description="Affects weekly comparisons and the scheduled review.">
              <Select
                label="Week starts on"
                hideLabel
                value={prefs.weekStart}
                onChange={(value) => setPrefs({ ...prefs, weekStart: value as UserPreference['weekStart'] })}
                options={[
                  { value: 'monday', label: 'Monday' },
                  { value: 'sunday', label: 'Sunday' },
                ]}
                className="max-w-[260px]"
              />
            </Row>
            <Row label="Motion" description="System follows your operating system setting. Always reduces motion everywhere in HELM.">
              <Select
                label="Motion"
                hideLabel
                value={prefs.reducedMotion}
                onChange={(value) => setPrefs({ ...prefs, reducedMotion: value as UserPreference['reducedMotion'] })}
                options={[
                  { value: 'system', label: 'Follow system setting' },
                  { value: 'always', label: 'Always reduce motion' },
                ]}
                className="max-w-[260px]"
              />
            </Row>
            <Row label="Briefing digest" description="A short summary of what changed, sent to your work email.">
              <Select
                label="Briefing digest"
                hideLabel
                value={prefs.briefingDigest}
                onChange={(value) => setPrefs({ ...prefs, briefingDigest: value as UserPreference['briefingDigest'] })}
                options={[
                  { value: 'daily', label: 'Every weekday morning' },
                  { value: 'weekly', label: 'Monday mornings only' },
                  { value: 'off', label: 'Off' },
                ]}
                className="max-w-[260px]"
              />
            </Row>
            <div className="border-t border-line pt-5">
              <Button variant="action" onClick={() => setSaved('Preferences saved.')}>
                Save preferences
              </Button>
            </div>
          </div>
        ) : null}

        {tab === 'brand' ? (
          <div className="space-y-4">
            <p className="max-w-prose text-[14px] leading-[21px] text-ink-500">
              What the creative director is told before it writes anything. The house rules travel
              verbatim into every brief, so they are written here in plain language rather than held
              in a config file nobody on the account can read.
            </p>
            <BrandKitEditor workspaceSlug={workspaceSlug} kits={brandKits} canEdit={canEditBrand} />
          </div>
        ) : null}

        {tab === 'audit' ? (
          <div className="space-y-4">
            <p className="max-w-prose text-[14px] leading-[21px] text-ink-500">
              Audit is for governance and diagnostics. “Since your last visit” on the Briefing is the
              user-centred interpretation of the same underlying events.
            </p>
            <ul className="s-panel divide-y divide-line p-0">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start gap-x-5 gap-y-1.5 px-5 py-3.5 sm:px-6">
                  <span className="mono w-[104px] shrink-0 text-[11.5px] text-ink-400">
                    {formatRelative(entry.at, nowIso)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-ink-950">
                      <span className="font-medium">{entry.actor}</span> · {entry.action}
                    </span>
                    <span className="mono block truncate text-[11.5px] text-ink-500">{entry.target}</span>
                    <span className="block text-[12.5px] text-ink-400">{entry.context}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('grid gap-3 border-b border-line pb-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:gap-6')}>
      <div>
        <p className="text-[14px] font-medium text-ink-950">{label}</p>
        <p className="mt-1 text-[12.5px] leading-[18px] text-ink-500">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}
