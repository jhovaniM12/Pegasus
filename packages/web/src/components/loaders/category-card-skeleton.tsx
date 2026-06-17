import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CategoryCardSkeletonProps = {
  /** Stagger index for entrance animation (0-based). */
  index?: number;
};

/**
 * Skeleton placeholder that mirrors the exact layout of a staff category card.
 */
export function CategoryCardSkeleton({ index = 0 }: CategoryCardSkeletonProps) {
  return (
    <article
      className={cn(
        "flex min-h-52 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm content-reveal",
      )}
      style={{ animationDelay: `${index * 75}ms` }}
    >
      <div className="space-y-4">
        {/* Header row: fair name + gait badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="h-6 w-28 rounded-md" />
        </div>

        {/* Metric boxes: Edad + Inscritos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-2 h-4 w-20" />
          </div>
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="mt-2 h-4 w-6" />
          </div>
        </div>

        {/* Stats row: Aprobados / Pendientes / FA cerrados */}
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
        </div>
      </div>

      {/* Action button */}
      <Skeleton className="mt-5 h-9 w-full rounded-md" />
    </article>
  );
}
