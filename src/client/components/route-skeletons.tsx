import { Skeleton } from '@/components/ui/skeleton';

export function KnowledgeWorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-10 py-8">
      {/* Metadata row skeleton */}
      <div className="flex gap-6">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-1.5 h-5 w-8" />
        </div>
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-1.5 h-5 w-6" />
        </div>
      </div>

      {/* Group card skeletons */}
      <div className="mt-7 flex flex-col gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-rule bg-tint">
            <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-8" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-6" />
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InterviewWorkspaceSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-10 py-14">
        {/* Question skeleton */}
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-4 h-4 w-1/2" />

        {/* Options skeleton */}
        <div className="mt-6 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
