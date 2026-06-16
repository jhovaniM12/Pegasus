import { ArrowLeft, CheckCircle2, Timer, Trophy } from "lucide-react";
import { formatFaFormDuration, formatRoundFormTime } from "./round-form-timing";
import type { ManagementJudgeForm } from "@/types/staged-flow";

function TrackChip({ position, variant = "neutral" }: { position: number; variant?: "neutral" | "final" }) {
  return (
    <span
      className={
        variant === "final"
          ? "inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 tabular-nums"
          : "inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 tabular-nums"
      }
    >
      #{position}
    </span>
  );
}

type FaConsolidatedDetailProps = {
  judgeForms: ManagementJudgeForm[];
  consolidated: Array<{ id: string; trackPosition: number; votesCount: number; finalPosition: number | null }>;
  judgingStartedAt: string | null;
  onBack: () => void;
};

export function FaConsolidatedDetail({
  judgeForms,
  consolidated,
  judgingStartedAt,
  onBack
}: FaConsolidatedDetailProps) {
  const sortedFinalists = [...consolidated].sort(
    (a, b) => (a.finalPosition ?? 999) - (b.finalPosition ?? 999)
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 bg-slate-50/80 px-5 py-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4.5 text-emerald-600" />
          <span className="text-base font-semibold text-slate-800">Formato FA Consolidado</span>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="size-3.5" />
          Volver
        </button>
      </div>

      <div className="space-y-4 p-5">
        {/* Per-judge cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {judgeForms
            .sort((a, b) => a.judgeName.localeCompare(b.judgeName))
            .map((form) => (
              <div key={form.id} className="rounded-lg border border-slate-200/70 bg-slate-50/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Formato FA</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">
                  {form.judgeName}{" "}
                  <span className="font-normal text-slate-500">({form.selectedCount} selecciones)</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                  <span>{formatRoundFormTime(form.closedAt)}</span>
                  {form.status === "CLOSED" && (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="size-3" />
                      Cerrado
                    </span>
                  )}
                  {formatFaFormDuration(form, { judgingStartedAt }) && (
                    <span className="inline-flex items-center gap-1 rounded border border-slate-200/40 bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                      <Timer className="size-3" />
                      {formatFaFormDuration(form, { judgingStartedAt })}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {form.selections.length > 0 ? (
                    form.selections.map((pos) => <TrackChip key={pos} position={pos} />)
                  ) : (
                    <span className="text-xs text-slate-400">Sin selecciones.</span>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Consolidated finalists */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-900">Consolidado FORMATO FA</span>
          </div>
          <p className="mt-0.5 text-xs text-emerald-700">
            Finalistas consolidados: <strong>{sortedFinalists.length} ejemplares.</strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sortedFinalists.length > 0 ? (
              sortedFinalists.map((finalist) => (
                <TrackChip key={finalist.id} position={finalist.trackPosition} variant="final" />
              ))
            ) : (
              <span className="text-xs text-slate-400">Sin finalistas consolidados.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
