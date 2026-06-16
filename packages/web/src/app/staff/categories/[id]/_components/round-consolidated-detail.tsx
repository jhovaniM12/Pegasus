import { ArrowLeft, CheckCircle2, Timer, Trophy } from "lucide-react";
import { OfficialResultBoard } from "./official-result-board";
import { formatRoundFormDuration, formatRoundFormTime } from "./round-form-timing";
import type { RoundManagementItem } from "@/types/staged-flow";

function detailTitle(round: RoundManagementItem): string {
  if (round.roundType === "F1") return "Formato F1 Consolidado";
  if (round.roundType === "F2") return "Formato F2 Consolidado";
  return `Desempate #${round.sequence} Consolidado`;
}

function formLabel(round: RoundManagementItem): string {
  if (round.roundType === "F1") return "Formato F1";
  if (round.roundType === "F2") return "Formato F2";
  return `Desempate #${round.sequence}`;
}

function resultTitle(round: RoundManagementItem): string {
  if (round.roundType === "F1") return "Resultado F1";
  if (round.roundType === "F2") return "Resultado F2";
  return `Resultado desempate #${round.sequence}`;
}

type RoundConsolidatedDetailProps = {
  round: RoundManagementItem;
  resolvedByTieBreak: boolean;
  onBack: () => void;
};

export function RoundConsolidatedDetail({ round, resolvedByTieBreak, onBack }: RoundConsolidatedDetailProps) {
  const isF1 = round.roundType === "F1";
  const isTieBreak = round.roundType === "TIE_BREAK";
  const isF2ResolvedByTieBreak = round.roundType === "F2" && resolvedByTieBreak;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 bg-slate-50/80 px-5 py-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4.5 text-emerald-600" />
          <span className="text-base font-semibold text-slate-800">{detailTitle(round)}</span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="size-3.5" />
          Volver
        </button>
      </div>

      <div className="space-y-4 p-5">
        {isTieBreak && round.tests.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Pruebas realizadas</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {round.tests.map((test) => (
                <span
                  key={test.id}
                  className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-800"
                >
                  {test.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {round.forms
            .slice()
            .sort((a, b) => a.judgeName.localeCompare(b.judgeName))
            .map((form) => {
              const entries = isF1 ? form.entries.filter((entry) => entry.selected) : form.entries;
              return (
                <div key={form.id} className="rounded-lg border border-slate-200/70 bg-slate-50/30 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{formLabel(round)}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">
                    {form.judgeName}{" "}
                    <span className="font-normal text-slate-500">
                      ({isF1 ? `${entries.length} selecciones` : `${entries.length} puestos`})
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                    <span>{formatRoundFormTime(form.closedAt)}</span>
                    {form.status === "CLOSED" && (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="size-3" />
                        Cerrado
                      </span>
                    )}
                    {formatRoundFormDuration(form, round) && (
                      <span className="inline-flex items-center gap-1 rounded border border-slate-200/40 bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                        <Timer className="size-3" />
                        {formatRoundFormDuration(form, round)}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {entries.length > 0 ? (
                      entries.map((entry) => (
                        <span
                          key={entry.participantId}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 tabular-nums"
                        >
                          #{entry.trackPosition}
                          {!isF1 && entry.position !== null && (
                            <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-bold text-blue-700">
                              {entry.position}°
                            </span>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">
                        {isF1 ? "Sin selecciones." : "Sin puestos registrados."}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {round.results.length > 0 || round.desertedResults.length > 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="size-4 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-900">Consolidado {formLabel(round)}</span>
            </div>
            <OfficialResultBoard
              results={round.results}
              desertedResults={round.desertedResults}
              showScoring={!isF1}
              title={resultTitle(round)}
              note={
                isF2ResolvedByTieBreak
                  ? "La suma y los primeros puestos corresponden al F2 original; el orden final fue definido por desempate."
                  : isTieBreak
                    ? "Este consolidado muestra cómo los jueces ordenaron a los ejemplares empatados para resolver el F2."
                    : undefined
              }
              provisionalLabel={
                isF2ResolvedByTieBreak ? "Resuelto por desempate" : isTieBreak ? "Resultado desempate" : undefined
              }
              provisionalVariant={isF2ResolvedByTieBreak || isTieBreak ? "tieBreak" : "neutral"}
            />
          </div>
        ) : (
          <p className="rounded-lg border border-slate-100 bg-slate-50/30 px-4 py-4 text-center text-sm text-slate-400">
            Aún no hay resultado consolidado para esta ronda.
          </p>
        )}
      </div>
    </div>
  );
}
