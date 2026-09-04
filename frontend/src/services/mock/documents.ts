import type { DocumentAnalytics, DocumentFormat, DocumentsResponse } from '@/services/http/queries';
import { artifacts } from './library';
import { runs } from './intelligence';

/**
 * The shelf, for a build with no API behind it.
 *
 * Every other surface already falls back to these fixtures when the API is
 * unreachable; documents was the one that did not, so the static export —
 * which has no API at all by design — answered the whole section with an
 * error panel. A demo that dead-ends on one of its own rail destinations
 * reads as a broken site rather than a read-only one.
 *
 * Composed from the fixtures rather than written out again: the documents are
 * the sample artifacts already filed under `reports`, and the sources are the
 * sample investigations. Nothing here can drift from the rest of the sample
 * workspace, because nothing here is a second copy of it.
 */

export const sampleDocuments = artifacts.filter((artifact) => artifact.mode === 'reports');

export const documentFormats: DocumentFormat[] = [
  { id: 'pdf', label: 'PDF', detail: 'Typeset for reading and filing' },
  { id: 'doc', label: 'Word', detail: 'Editable, for a document that will be marked up' },
  { id: 'md', label: 'Markdown', detail: 'The frozen body every other format renders from' },
  { id: 'html', label: 'HTML', detail: 'One page, for sending as a link' },
  { id: 'json', label: 'JSON', detail: 'The structured record behind the prose' },
];

/** Finished investigations are the only ones worth writing up. */
const writable = runs.filter((run) => run.stage === 'complete' || run.stage === 'waiting_for_approval');

const sources: DocumentsResponse['sources'] = writable.map((run) => ({
  id: run.id,
  title: run.title,
  stage: run.stage,
  rangeLabel: run.rangeLabel,
  scopeLabel: run.scopeLabel,
  findingCount: run.findingIds.length,
  alreadyWritten: sampleDocuments.some((doc) => doc.linkedRunId === run.id || doc.id === run.artifactId),
}));

const unwritten = sources.filter((source) => !source.alreadyWritten).length;

const analytics: DocumentAnalytics = {
  total: sampleDocuments.length,
  byStatus: sampleDocuments.reduce<Record<string, number>>((tally, doc) => {
    tally[doc.status] = (tally[doc.status] ?? 0) + 1;
    return tally;
  }, {}),
  // Counted from the summaries actually present, so the figure is the shelf's
  // own rather than a number somebody typed.
  words: sampleDocuments.reduce(
    (sum, doc) => sum + (doc.summary ? doc.summary.trim().split(/\s+/).length : 0),
    0,
  ),
  unwrittenRuns: unwritten,
  // A rounded percentage, the same shape the API returns — not a fraction.
  coverage: sources.length ? Math.round(((sources.length - unwritten) / sources.length) * 100) : null,
  // The most recent thing on the shelf, read off the shelf itself.
  lastWrittenAt: sampleDocuments.reduce<string | null>(
    (latest, doc) => (!latest || doc.updatedAt > latest ? doc.updatedAt : latest),
    null,
  ),
};

export const sampleDocumentsResponse: DocumentsResponse = {
  documents: sampleDocuments,
  formats: documentFormats,
  // Nothing can be written or published without the API that would do it.
  canWrite: false,
  canPublish: false,
  analytics,
  sources,
};
