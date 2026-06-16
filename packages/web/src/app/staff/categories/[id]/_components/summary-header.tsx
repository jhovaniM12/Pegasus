import { FlowProgress } from "@/components/flow-progress";
import { StageStatusBadge } from "@/components/stage-status-badge";
import type { StagedCategory } from "@/types/staged-flow";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function SummaryHeader({ summary }: { summary: StagedCategory }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {summary.fair.name ?? "Feria"}
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-950">{summary.category.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{summary.gait.name}</p>
        </div>
        <StageStatusBadge status={summary.status} />
      </div>
      <div className="mb-5 mt-5 border-b border-t border-slate-100 py-4">
        <FlowProgress currentStatus={summary.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Inscritos" value={summary.totalEntries} />
        <Metric label="Aprobados" value={summary.veterinary.approved} />
        <Metric label="Pendientes" value={summary.veterinary.pending} />
        <Metric label="FA cerrados" value={`${summary.judging.closedForms}/${summary.judging.totalJudges}`} />
      </div>
    </div>
  );
}
