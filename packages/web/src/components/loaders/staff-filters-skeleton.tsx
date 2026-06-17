import { Skeleton } from "@/components/ui/skeleton";

export function StaffFiltersSkeleton() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 w-28 rounded-md" />
      <Skeleton className="h-9 w-36 rounded-md" />
    </div>
  );
}
