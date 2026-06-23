import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StatCardSkeleton() {
  return (
    <Card className="rounded-xl border border-border bg-card subtle-shadow gap-0">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-5 px-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-9 rounded-lg" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="mt-2 h-4 w-full max-w-52" />
        <Skeleton className="mt-3 h-5 w-20 rounded-full" />
      </CardContent>
    </Card>
  );
}
