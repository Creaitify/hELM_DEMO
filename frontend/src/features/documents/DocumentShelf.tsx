'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Artifact } from '@/contracts';
import type { DocumentFormat, DocumentsResponse } from '@/services/http/queries';
import { Button } from '@/components/primitives/Button';
import { StatusBadge } from '@/components/primitives/Status';
import { EmptyState, SectionHeading } from '@/components/primitives/States';
import { Drawer } from '@/components/primitives/Overlay';
import { IconDownload, IconEvidence, IconLock, IconSpark } from '@/components/icons';
import { api, describeError } from '@/lib/api';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

/**
 * Documents.
 *
 * A generated image is looked at; a memo is read, cited, and handed to somebody
 * who was not in the room. Behind one tab neither got what it needed, so this
 * is the shelf for the second kind — written from what the fleet found, frozen
 * at the moment of writing, and downloadable in the formats a board pack or an
 * email actually asks for.
 */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DownloadRow({
  slug,
  document,
  formats,
}: {
  slug: string;
  document: Artifact;
  formats: DocumentFormat[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {formats.map((format) => (
        <a
          key={format.id}
          href={`/api/workspaces/${slug}/documents/${document.id}/download?format=${format.id}`}
          title={format.detail}
          className="inline-flex items-center gap-1 rounded-control border border-line px-2.5 py-1 text-[12px] text-ink-500 transition-colors hover:border-line-strong hover:bg-surface-subtle hover:text-ink-950"
        >
          <IconDownload size={12} />
          {format.label}
        </a>
      ))}
    </div>
  );
}

export function DocumentShelf({
  workspaceSlug,
  data,
}: {
  workspaceSlug: string;
  data: DocumentsResponse;
}) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState(
    data.sources.find((source) => !source.alreadyWritten)?.id ?? data.sources[0]?.id ?? '',
  );
  const [writing, setWriting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [written, setWritten] = useState<Artifact[]>([]);
  const [reading, setReading] = useState<Artifact | null>(null);

  const documents = [...written, ...data.documents];
  const source = data.sources.find((entry) => entry.id === sourceId);

  const write = async () => {
    if (!sourceId) return;
    setWriting(true);
    setProblem(null);
    try {
      const response = await api.post<{ document: Artifact }>(
        `/api/workspaces/${workspaceSlug}/documents`,
        { runId: sourceId },
      );
      setWritten((current) => [response.document, ...current]);
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Write one from what the fleet found */}
      <section aria-labelledby="write" className="s-panel px-5 py-5">
        <SectionHeading
          id="write"
          title="Write one up"
          hint="A memo is written from the run: its findings, its recommendations, and the decisions taken on them."
        />

        {data.sources.length === 0 ? (
          <p className="mt-4 text-[13.5px] text-ink-500">
            No investigation has finished yet. Start one from the{' '}
            <a href={routes.intelligence(workspaceSlug)} className="text-helm-600 hover:underline">
              agent fleet
            </a>
            , and it can be written up when it lands.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1">
              <span className="micro-label">Investigation</span>
              <select
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-field border border-line-strong bg-surface-sunk px-3 text-[13.5px] text-ink-950 outline-none focus:border-helm-500 focus:bg-surface"
              >
                {data.sources.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                    {entry.alreadyWritten ? ' — already written' : ''}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="action"
              onClick={() => void write()}
              disabled={!data.canWrite || !sourceId}
              pending={writing}
              pendingLabel="Writing…"
              leading={<IconSpark size={15} />}
            >
              Write the memo
            </Button>
          </div>
        )}

        {source ? (
          <p className="mono mt-2.5 text-[11.5px] text-ink-400">
            {source.scopeLabel} · {source.rangeLabel} · {source.findingCount} findings ·{' '}
            {source.stage.replace(/_/g, ' ')}
          </p>
        ) : null}

        {!data.canWrite ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink-500">
            <IconLock size={13} />
            Writing a document needs the analyst role or above.
          </p>
        ) : null}

        <div aria-live="polite" className="min-h-[20px]">
          {problem ? <p className="mt-2 text-[13px] text-bad">{problem}</p> : null}
        </div>
      </section>

      {/* The shelf */}
      <section aria-labelledby="shelf">
        <SectionHeading
          id="shelf"
          title="On the shelf"
          hint="Each memo says what was true when it was written, not what the numbers say now."
          action={
            documents.length ? <StatusBadge tone="neutral">{documents.length}</StatusBadge> : undefined
          }
        />

        {documents.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No documents yet"
              description="Write one from a finished investigation above. It keeps the findings, the recommendations and the basis they were decided on."
              icon={<IconEvidence size={20} />}
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {documents.map((document) => (
              <li key={document.id} className="s-panel px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setReading(document)}
                      className="text-left text-[15px] font-medium leading-snug text-ink-950 hover:text-helm-600"
                    >
                      {document.title}
                    </button>
                    <p className="mt-1 text-[13px] leading-[19px] text-ink-500">{document.summary}</p>
                    <p className="mono mt-1.5 text-[11px] text-ink-400">
                      {document.createdBy} · {formatDate(document.updatedAt)}
                      {document.tags.length ? ` · ${document.tags.join(' · ')}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge tone={document.status === 'approved' ? 'good' : 'neutral'}>
                      {document.status.replace(/_/g, ' ')}
                    </StatusBadge>
                    <DownloadRow slug={workspaceSlug} document={document} formats={data.formats} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Drawer
        open={Boolean(reading)}
        onClose={() => setReading(null)}
        title={reading?.title ?? 'Document'}
        description="As written, in full."
      >
        {reading ? (
          <div className="space-y-4">
            <DownloadRow slug={workspaceSlug} document={reading} formats={data.formats} />
            <article
              className={cn(
                'whitespace-pre-wrap rounded-card border border-line bg-surface-subtle px-4 py-4',
                'text-[13px] leading-[20px] text-ink-700',
              )}
            >
              {reading.content ?? reading.summary}
            </article>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
