import { Skeleton } from '@/components/primitives/States';

/** Geometry-matched skeleton so nothing jumps when data lands. */
export default function WorkspaceLoading() {
  return (
    <div className="mx-auto w-full max-w-shell px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-9 w-[180px]" />
      <Skeleton className="mt-3 h-4 w-[320px]" />
      <div className="s-panel mt-7 grid divide-y divide-line p-0 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="px-5 py-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-6 w-24" />
            <Skeleton className="mt-3 h-3 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-8 h-[220px] w-full rounded-card" />
      <Skeleton className="mt-5 h-[180px] w-full rounded-card" />
    </div>
  );
}
