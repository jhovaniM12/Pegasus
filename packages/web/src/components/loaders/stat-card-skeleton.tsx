import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function StatCardSkeleton() {
  return (
    <Card className="rounded-lg border border-slate-200 bg-white py-0 subtle-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-16" />
          </div>
          <Skeleton className="size-10 rounded-lg" />
        </div>
        <Skeleton className="mt-4 h-4 w-full" />
      </CardContent>
    </Card>
  );
}
