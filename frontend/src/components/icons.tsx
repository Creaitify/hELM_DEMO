import type { SVGProps } from 'react';

/**
 * Code-native icon family. 24-unit grid, 1.6 stroke, square-ish joins.
 * Bespoke shapes for connection, account scope, evidence and decision so the
 * set reads as HELM rather than a generic pack.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ---- Primary navigation ---- */

/** Briefing: a reading rule with the decisive point marked. */
export const IconBriefing = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6.5h11M3.5 11h8M3.5 15.5h6" />
    <circle cx="17.5" cy="14.5" r="3" />
    <path d="M17.5 11.5v-5" />
  </Icon>
);

/** Campaigns: ranked comparison columns. */
export const IconCampaigns = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V11M9.33 20V5M14.67 20v-6M20 20V8" />
    <path d="M3 20h18" />
  </Icon>
);

/** Intelligence: the decision spine — signal, split, resolution. */
export const IconIntelligence = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12h4" />
    <path d="M7 12c3 0 3-5 6-5h2" />
    <path d="M7 12c3 0 3 5 6 5h2" />
    <circle cx="17.5" cy="7" r="2" />
    <circle cx="17.5" cy="17" r="2" />
    <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

/** Library: stacked artifacts. */
export const IconLibrary = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
    <path d="m4 12 8 3.5L20 12" />
    <path d="m4 16.5 8 3.5 8-3.5" />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
);

/** Connections: a deliberate patch, not a casual toggle. */
export const IconConnection = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4v4M15 4v4" />
    <path d="M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0V8Z" />
    <path d="M12 17v3" />
  </Icon>
);

/** Account scope: a stack of sources resolved into one selection. */
export const IconScope = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="7" height="6" rx="1.5" />
    <rect x="3" y="14" width="7" height="6" rx="1.5" />
    <path d="M10 7h4.5a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2H21" />
    <path d="M10 17h4.5" />
  </Icon>
);

/** Evidence: a record with a measured rule alongside it. */
export const IconEvidence = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3.5h8.5L19 8v12.5H6V3.5Z" />
    <path d="M14 3.5V8h5" />
    <path d="M9 12h6M9 15.5h4" />
  </Icon>
);

/** Decision: a path that resolves to one chosen branch. */
export const IconDecision = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 18V9a3 3 0 0 1 3-3h9" />
    <path d="m13 3 3.5 3L13 9" />
    <circle cx="4" cy="20" r="1.6" fill="currentColor" stroke="none" />
    <path d="M9 18h11" strokeDasharray="2 2.6" />
  </Icon>
);

/* ---- Instrument and status ---- */

export const IconFreshness = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5 21 19.5H3L12 4.5Z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Icon>
);

export const IconCheckCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="m8.2 12.2 2.6 2.6 5-5.6" />
  </Icon>
);

export const IconWarning = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M12 7.5V13" />
    <circle cx="12" cy="16.4" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconPaused = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M10 9.5v5M14 9.5v5" />
  </Icon>
);

export const IconSyncing = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4.5V9h-4.5" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9.5 6 5.5 6-5.5" />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9.5 5.5 6 6.5-6 6.5" />
  </Icon>
);

export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 5.5 8.5 12l6 6.5" />
  </Icon>
);

export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15" />
    <path d="m13.5 6.5 5.5 5.5-5.5 5.5" />
  </Icon>
);

export const IconArrowUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19V5" />
    <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
  </Icon>
);

export const IconArrowDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14" />
    <path d="m6.5 13.5 5.5 5.5 5.5-5.5" />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.6 15.6 4 4" />
  </Icon>
);

export const IconFilter = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6.5h16M7 12h10M10 17.5h4" />
  </Icon>
);

export const IconColumns = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M9.5 4.5v15M15 4.5v15" />
  </Icon>
);

export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="14" rx="2" />
    <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
  </Icon>
);

export const IconCompare = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5h11" />
    <path d="m11.5 5 3.5 3.5L11.5 12" />
    <path d="M20 15.5H9" />
    <path d="M12.5 12 9 15.5 12.5 19" />
  </Icon>
);

export const IconMore = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconExternal = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 4.5H19.5V10.5" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v10" />
    <path d="m7.5 10 4.5 4 4.5-4" />
    <path d="M4.5 18.5h15" />
  </Icon>
);

export const IconShare = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="17.5" cy="6" r="2.6" />
    <circle cx="6.5" cy="12" r="2.6" />
    <circle cx="17.5" cy="18" r="2.6" />
    <path d="m8.9 10.8 6.2-3.4M8.9 13.2l6.2 3.4" />
  </Icon>
);

export const IconBookmark = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 4.5h11v15l-5.5-4-5.5 4v-15Z" />
  </Icon>
);

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Icon>
);

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 19.5 6v6c0 4.2-3 7.4-7.5 8.5C7.5 19.4 4.5 16.2 4.5 12V6L12 3.5Z" />
    <path d="m9.2 12 2 2 3.6-4" />
  </Icon>
);

export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20c.9-3.6 3.6-5.5 7-5.5s6.1 1.9 7 5.5" />
  </Icon>
);

export const IconRail = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M9.5 4.5v15" />
  </Icon>
);

export const IconCommand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 5.5a2.5 2.5 0 1 0 2.5 2.5v8a2.5 2.5 0 1 0 2.5-2.5h-8a2.5 2.5 0 1 0 2.5 2.5v-8a2.5 2.5 0 1 0-2.5-2.5Z" />
  </Icon>
);

export const IconSpark = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
    <path d="M12 8.5a3.5 3.5 0 0 0 3.5 3.5A3.5 3.5 0 0 0 12 15.5 3.5 3.5 0 0 0 8.5 12 3.5 3.5 0 0 0 12 8.5Z" />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 7h15" />
    <path d="M9 7V4.5h6V7" />
    <path d="M6.5 7l.8 12.5h9.4L17.5 7" />
    <path d="M10 11v5M14 11v5" />
  </Icon>
);

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12a7.5 7.5 0 0 1 12.9-5.2" />
    <path d="M19.5 12a7.5 7.5 0 0 1-12.9 5.2" />
    <path d="M17.5 3.5v3.5H14M6.5 20.5V17H10" />
  </Icon>
);

export const IconDismiss = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Icon>
);

export const IconRevise = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10v3Z" />
    <path d="m14 6.5 3 3" />
  </Icon>
);

/* ---- Provider marks ---- */
/* Provider colour appears only in identity marks, never as a page theme. */

export function GoogleAdsMark({ size = 18, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2.6 16.1 8.9 5.2a2.6 2.6 0 0 1 4.5 2.6L7.1 18.7a2.6 2.6 0 0 1-4.5-2.6Z"
        fill={mono ? 'currentColor' : 'var(--google-yellow)'}
        opacity={mono ? 0.55 : 1}
      />
      <path
        d="M21.4 16.1 15.1 5.2a2.6 2.6 0 0 0-4.5 2.6l6.3 10.9a2.6 2.6 0 0 0 4.5-2.6Z"
        fill={mono ? 'currentColor' : 'var(--google)'}
      />
      <circle cx="5" cy="17.4" r="2.9" fill={mono ? 'currentColor' : 'var(--google-green)'} />
    </svg>
  );
}

export function MetaAdsMark({ size = 18, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 14.4c0-3.9 1.9-7 4.4-7 1.5 0 2.6 1 3.9 3 .5.8.9 1.5 1.4 2.4.6-.9 1-1.6 1.5-2.4 1.3-2 2.4-3 3.9-3 2.5 0 4.4 3.1 4.4 7 0 2.4-1 3.9-2.9 3.9-1.4 0-2.4-.8-3.7-2.9l-1.3-2.2c-.4-.7-.7-1.2-1-1.7-.3.5-.6 1-1 1.7l-1.3 2.2c-1.3 2.1-2.3 2.9-3.7 2.9C4 18.3 3 16.8 3 14.4Zm3.1-.2c0 1.5.5 2.3 1.4 2.3.7 0 1.2-.4 2.1-1.8l1-1.6-.9-1.5C8.9 10 8.3 9.5 7.6 9.5c-.9 0-1.5 1.4-1.5 4.7Zm9.3-1.1 1 1.6c.9 1.4 1.4 1.8 2.1 1.8.9 0 1.4-.8 1.4-2.3 0-3.3-.6-4.7-1.5-4.7-.7 0-1.3.5-2.1 1.9l-.9 1.7Z"
        fill={mono ? 'currentColor' : 'var(--meta)'}
      />
    </svg>
  );
}

export function GoogleGMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.35Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path d="M6.41 13.92a6 6 0 0 1 0-3.84V7.5H3.07a10 10 0 0 0 0 9l3.34-2.58Z" fill="#FBBC05" />
      <path
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.07 7.5l3.34 2.58C7.2 7.74 9.4 5.98 12 5.98Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function ProviderMark({
  provider,
  size = 18,
  mono = false,
}: {
  provider: 'google_ads' | 'meta_ads' | 'upload';
  size?: number;
  mono?: boolean;
}) {
  if (provider === 'google_ads') return <GoogleAdsMark size={size} mono={mono} />;
  if (provider === 'meta_ads') return <MetaAdsMark size={size} mono={mono} />;
  return <IconEvidence size={size} />;
}

export function providerLabel(provider: 'google_ads' | 'meta_ads' | 'upload'): string {
  if (provider === 'google_ads') return 'Google Ads';
  if (provider === 'meta_ads') return 'Meta Ads';
  return 'File import';
}

/** Team: two figures, the second half-weight so the pair reads as a group. */
export const IconTeam = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9.5" cy="8" r="3.1" />
    <path d="M3.6 19.4c.5-3.2 3-5 5.9-5s5.4 1.8 5.9 5" />
    <path d="M16.3 6.1a3 3 0 0 1 0 5.6" opacity=".55" />
    <path d="M18 14.9c1.4.7 2.3 2.1 2.5 4.1" opacity=".55" />
  </Icon>
);

/** Audit: a ledger of entries with one line struck as verified. */
export const IconAudit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.2h11.2L20 8v11.8H5z" />
    <path d="M16 4.2V8h4" />
    <path d="M8.4 12.4h7.2M8.4 15.9h4.6" />
  </Icon>
);
