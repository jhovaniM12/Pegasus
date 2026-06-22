"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Eye, Gavel, Timer, Trophy } from "lucide-react";
import { RoundConsolidatedDetail } from "./round-consolidated-detail";
import { formatRoundFormDuration, formatRoundFormTime } from "./round-form-timing";
import type { RoundFormStatus, RoundManagementItem } from "@/types/staged-flow";

function roundTitle(round: RoundManagementItem): string {
  if (round.roundType === "F1") return "Formato F1 — Cabeza de lote";
  if (round.roundType === "F2") return "Formato F2 — Tarjeta final";
  return `Desempate #${round.sequence}`;
}

function viewButtonLabel(round: RoundManagementItem): string {
  if (round.roundType === "F1") return "Ver F1";
  if (round.roundType === "F2") return "Ver F2";
  return `Ver desempate #${round.sequence}`;
}

function formStatusBadge(status: RoundFormStatus) {
  if (status === "CLOSED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="size-3.5" /> Cerrada
      </span>
    );
  }
  if (status === "STARTED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
        <Gavel className="size-3.5" /> En progreso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
      <Clock className="size-3.5" /> Pendiente
    </span>
  );
}

function canViewDetail(round: RoundManagementItem): boolean {
  return (
    round.status !== "OPEN" &&
    round.forms.some((form) => form.status === "CLOSED") &&
    (round.results.length > 0 || round.desertedResults.length > 0)
  );
}

export function RoundCompactSection({
  round,
  resolvedByTieBreak = false,
  isActive = false,
}: {
  round: RoundManagementItem;
  resolvedByTieBreak?: boolean;
  isActive?: boolean;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const closed = round.forms.filter((form) => form.status === "CLOSED").length;

  if (showDetail) {
    return (
      <RoundConsolidatedDetail
        round={round}
        resolvedByTieBreak={resolvedByTieBreak}
        onBack={() => setShowDetail(false)}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200/60 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Trophy className="size-4.5 text-slate-600" />
          <span className="text-base font-semibold text-slate-800">{roundTitle(round)}</span>
          {isActive && (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Activo
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 rounded border border-slate-200/40 bg-slate-100 px-2 py-1 text-slate-700">
            Tarjetas cerradas: <strong className="font-semibold">{closed}/{round.forms.length}</strong>
          </span>
          {(round.results.length > 0 || round.desertedResults.length > 0) && (
            <span className="flex items-center gap-1.5 rounded border border-slate-200/40 bg-slate-100 px-2 py-1 text-slate-700">
              Resultados:{" "}
              <strong className="font-semibold text-slate-800">
                {round.results.length + round.desertedResults.length}
              </strong>
            </span>
          )}
          {canViewDetail(round) && (
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Eye className="size-3.5" />
              {viewButtonLabel(round)}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5 p-5">
        {round.forms.length === 0 ? (
          <p className="rounded-lg border border-slate-100 bg-slate-50/30 px-4 py-4 text-center text-sm text-slate-400">
            Sin tarjetas registradas.
          </p>
        ) : (
          round.forms
            .slice()
            .sort((a, b) => a.judgeName.localeCompare(b.judgeName))
            .map((form) => (
              <div
                key={form.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200/60 bg-slate-50/30 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded border border-slate-200/40 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Juez
                    </span>
                    <p className="truncate text-sm font-semibold text-slate-800">{form.judgeName}</p>
                  </div>
                  {form.status === "CLOSED" && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-slate-400" />
                        {formatRoundFormTime(form.closedAt)}
                      </span>
                      {formatRoundFormDuration(form, round) && (
                        <span className="inline-flex items-center gap-1 rounded border border-slate-200/40 bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                          <Timer className="size-3" />
                          {formatRoundFormDuration(form, round)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0 self-start sm:self-center">{formStatusBadge(form.status)}</div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

export function RoundsSummarySection({
  rounds,
  excludeRoundIds = [],
}: {
  rounds: RoundManagementItem[];
  excludeRoundIds?: string[];
}) {
  const excluded = new Set(excludeRoundIds);
  const visibleRounds = rounds.filter(
    (round) =>
      !excluded.has(round.id) &&
      round.status !== "OPEN" &&
      (round.roundType === "F1" || round.roundType === "F2" || round.roundType === "TIE_BREAK")
  );
  const f2 = visibleRounds.find((round) => round.roundType === "F2");
  const resolvedByTieBreak =
    Boolean(f2) && rounds.some((round) => round.roundType === "TIE_BREAK" && round.status === "CONSOLIDATED");

  if (visibleRounds.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Resumen F1 / F2 / Desempates</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Consulta el estado de las tarjetas y abre el detalle consolidado con tiempos por juez.
        </p>
      </div>
      {visibleRounds.map((round) => (
        <RoundCompactSection key={round.id} round={round} resolvedByTieBreak={resolvedByTieBreak} />
      ))}
    </div>
  );
}
