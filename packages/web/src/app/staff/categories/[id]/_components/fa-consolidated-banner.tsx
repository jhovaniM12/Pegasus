import { Trophy } from "lucide-react";
import type { FaConsolidatedFinalist } from "@/types/staged-flow";

type FaConsolidatedBannerProps = {
  consolidated: FaConsolidatedFinalist[];
};

export function FaConsolidatedBanner({ consolidated }: FaConsolidatedBannerProps) {
  const sortedFinalists = [...consolidated].sort((a, b) => a.trackPosition - b.trackPosition);

  if (sortedFinalists.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-emerald-700" />
        <span className="text-sm font-semibold text-emerald-900">Consolidado FORMATO FA</span>
      </div>
      <p className="mt-0.5 text-xs text-emerald-700">
        Finalistas consolidados: <strong>{sortedFinalists.length} ejemplares.</strong>
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sortedFinalists.map((finalist) => (
          <span
            key={finalist.id}
            className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 tabular-nums"
          >
            #{finalist.trackPosition}
          </span>
        ))}
      </div>
    </div>
  );
}
