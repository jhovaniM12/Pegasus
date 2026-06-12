import { CheckCircle2, Loader2, Lock } from "lucide-react";
import type { StageStatus } from "@/types/staged-flow";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type FaClosedStateProps = {
  closedAt: string | null;
  selectedCount: number;
  stageStatus: StageStatus;
};

/**
 * Read-only state shown to a judge after they close their FA form.
 * Communicates that the form is locked and the system is waiting for
 * the Technical Director to advance the flow.
 */
export function FaClosedState({ closedAt, selectedCount, stageStatus }: FaClosedStateProps) {
  const consolidated = stageStatus === "FA_CONSOLIDATED" || stageStatus === "JUDGING_CLOSED";

  return (
    <div className="space-y-4">
      {/* Closed banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-900">Formato FA cerrado</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            Cerrado el: <strong>{formatDate(closedAt)}</strong> · {selectedCount} seleccionados
          </p>
          <p className="text-xs text-emerald-700">Ya no puedes modificar tus selecciones.</p>
        </div>
      </div>

      {/* Waiting / consolidated card */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          {consolidated ? <CheckCircle2 className="size-6 text-emerald-600" /> : <Lock className="size-6" />}
        </span>
        {consolidated ? (
          <>
            <p className="text-base font-semibold text-slate-900">Juzgamiento consolidado</p>
            <p className="max-w-md text-sm text-slate-500">
              El Director Técnico ya consolidó los resultados. Puedes visualizar tu pre-selección a continuación.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-slate-900">Esperando al Director Técnico</p>
            <p className="max-w-md text-sm text-slate-500">
              El formato FA ha sido cerrado. Por favor, espera a que se active la siguiente fase.
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs italic text-slate-400">
              <Loader2 className="size-3.5 animate-spin" />
              Sincronizando en tiempo real...
            </span>
          </>
        )}
      </div>
    </div>
  );
}
