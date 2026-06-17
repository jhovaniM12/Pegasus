import { Skeleton } from "@/components/ui/skeleton";

type DetailPageSkeletonProps = {
  fields?: number;
};

/** Generic skeleton for catalog detail pages (recordatorios, etc.). */
export function DetailPageSkeleton({ fields = 4 }: DetailPageSkeletonProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 subtle-shadow">
        <dl className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: fields }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
