import { CheckCircle2, Loader2, Lock, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export type FaNextRoundAction = {
  roundKey: "F1" | "F2";
  participantCount: number | null;
  formStatus: "PENDING" | "STARTED";
  onStart: () => void;
};

type FaClosedStateProps = {
  closedAt: string | null;
  selectedCount: number;
  stageStatus: StageStatus;
  syncUnavailable?: boolean;
  /** Finalistas oficiales; se muestran incrustados en el mismo bloque cerrado. */
  consolidated?: Array<{ id: string; trackPosition: number }>;
  /** Cuando el DT ya habilitó P1/P2, muestra CTA para entrar a esa prueba. */
  nextRound?: FaNextRoundAction | null;
  busy?: boolean;
};

/**
 * Read-only state shown to a judge after they close their FA form.
 * Communicates waiting for DT consolidation/activation, or CTA when P1/P2 is ready.
 */
export function FaClosedState({
  closedAt,
  selectedCount,
  stageStatus,
  syncUnavailable = false,
  consolidated = [],
  nextRound = null,
  busy = false,
}: FaClosedStateProps) {
  const stageConsolidated =
    stageStatus === "FA_CONSOLIDATED" ||
    stageStatus === "F1_IN_PROGRESS" ||
    stageStatus === "F1_CONSOLIDATED" ||
    stageStatus === "F2_IN_PROGRESS" ||
    stageStatus === "JUDGING_CLOSED" ||
    stageStatus === "JUDGING_DESERTED";
  const sortedFinalists = [...consolidated].sort((a, b) => a.trackPosition - b.trackPosition);
  const hasFinalists = sortedFinalists.length > 0;
  const roundLabel = nextRound?.roundKey === "F1" ? "P1" : nextRound?.roundKey === "F2" ? "P2" : null;
  const awaitingConsolidation = stageStatus === "JUDGING_STARTED";
  const awaitingRoundActivation = stageStatus === "FA_CONSOLIDATED" && !nextRound;
  const showNextRoundCard = Boolean(nextRound);
  const showWaitingCard = !showNextRoundCard && (awaitingConsolidation || awaitingRoundActivation);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">Formato FA cerrado</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Cerrado el: <strong>{formatDate(closedAt)}</strong>
              {!hasFinalists && (
                <>
                  {" "}
                  · {selectedCount} seleccionados
                </>
              )}
            </p>
            <p className="text-xs text-emerald-700">Ya no puedes modificar tus selecciones.</p>
          </div>
        </div>

        {hasFinalists && (
          <div className="mt-3 border-t border-emerald-200/70 pt-3">
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
        )}
      </div>

      {showNextRoundCard && nextRound && roundLabel && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-violet-200 bg-violet-50/70 px-6 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Play className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-900">
              Prueba individual {roundLabel} habilitada
            </p>
            <p className="mx-auto max-w-md text-sm text-slate-600">
              El Director Técnico ya activó la prueba individual {roundLabel}. Puedes{" "}
              {nextRound.formStatus === "STARTED" ? "continuar" : "iniciar"} tu tarjeta.
              {nextRound.participantCount != null && (
                <>
                  {" "}
                  ({nextRound.participantCount} finalistas)
                </>
              )}
            </p>
          </div>
          <Button
            className="bg-violet-600 text-white hover:bg-violet-700"
            disabled={busy}
            onClick={nextRound.onStart}
          >
            <Play className="size-4" />
            {nextRound.formStatus === "STARTED"
              ? `Continuar prueba individual ${roundLabel}`
              : `Iniciar prueba individual ${roundLabel}`}
          </Button>
        </div>
      )}

      {showWaitingCard && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            {stageConsolidated ? (
              <CheckCircle2 className="size-6 text-emerald-600" />
            ) : (
              <Lock className="size-6" />
            )}
          </span>
          {awaitingRoundActivation ? (
            <>
              <p className="text-base font-semibold text-slate-900">Esperando al Director Técnico</p>
              <p className="max-w-md text-sm text-slate-500">
                El FA ya está consolidado. Espera a que el Director Técnico habilite la prueba
                individual P1 o P2.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-900">Esperando al Director Técnico</p>
              <p className="max-w-md text-sm text-slate-500">
                El formato FA ha sido cerrado. Por favor, espera a que se consolide y se active la
                siguiente fase.
              </p>
            </>
          )}
          {syncUnavailable ? (
            <span className="inline-flex text-xs font-medium text-red-600">
              Sesión expirada. Vuelve a ingresar para actualizar la categoría.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs italic text-slate-400">
              <Loader2 className="size-3.5 animate-spin" />
              Sincronizando en tiempo real...
            </span>
          )}
        </div>
      )}
    </div>
  );
}
