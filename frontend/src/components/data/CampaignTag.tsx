import { campaignIdentity } from '@/lib/campaign-color';
import { cn } from '@/lib/cn';

/**
 * A campaign's identity colour, always attached to its name.
 *
 * The dot is a recognition shortcut, not the identifier: six colours cover
 * eleven campaigns, so two can share one, and the name is what actually
 * resolves the ambiguity.
 */
export function CampaignDot({ campaignId, size = 8 }: { campaignId: string; size?: number }) {
  const identity = campaignIdentity(campaignId);
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: identity.mark }}
    />
  );
}

export function CampaignTag({
  campaignId,
  name,
  className,
}: {
  campaignId: string;
  name: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-500', className)}>
      <CampaignDot campaignId={campaignId} />
      <span className="truncate">{name}</span>
    </span>
  );
}
