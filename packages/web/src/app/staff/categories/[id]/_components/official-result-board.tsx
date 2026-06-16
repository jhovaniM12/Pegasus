"use client";

import { AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesertedRoundResult, RoundResult } from "@/types/staged-flow";

type OfficialResultBoardProps = {
  results: RoundResult[];
  desertedResults?: DesertedRoundResult[];
  /** F2 muestra suma de puestos y primeros lugares; F1 solo conteo de votos. */
  showScoring?: boolean;
  title?: string;
  note?: string;
  provisionalLabel?: string;
  provisionalVariant?: "neutral" | "tieBreak";
};

export function OfficialResultBoard({
  results,
  desertedResults = [],
  showScoring = true,
  title = "Resultado F2",
  note,
  provisionalLabel = "Provisional",
  provisionalVariant = "neutral",
}: OfficialResultBoardProps) {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">
        Aún no hay resultados consolidados.
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => (a.finalPosition ?? 0) - (b.finalPosition ?? 0));
  const desertedByPosition = new Map(desertedResults.map((row) => [row.finalPosition, row]));
  const maxPosition = Math.max(
    0,
    ...sorted.map((row) => row.finalPosition ?? 0),
    ...desertedResults.map((row) => row.finalPosition)
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200/60 bg-slate-50/80 px-5 py-3">
        <Trophy className="size-4.5 text-slate-600" />
        <span className="text-base font-semibold text-slate-800">{title}</span>
      </div>
      {note && (
        <div className="border-b border-blue-100 bg-blue-50/70 px-5 py-3 text-xs font-medium text-blue-800">
          {note}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left">
          <thead>
            <tr className="border-b border-slate-200/60 bg-slate-50/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-2.5 pl-4 pr-2 w-14">Puesto</th>
              <th className="py-2.5 pr-3">Ejemplar</th>
              {showScoring && <th className="py-2.5 pr-3 text-right">Suma</th>}
              {showScoring && <th className="py-2.5 pr-3 text-right">1.os</th>}
              <th className="py-2.5 pr-4 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxPosition }, (_, index) => index + 1).map((position) => {
              const row = sorted.find((result) => result.finalPosition === position);
              const desertedRow = desertedByPosition.get(position);
              if (!row && !desertedRow) return null;

              return (
                <tr
                  key={row?.id ?? `deserted-${position}`}
                  className={cn(
                    "border-b border-slate-100 text-sm last:border-0",
                    row?.status === "TIED" ? "bg-amber-50/60" : desertedRow ? "bg-slate-50/70" : "hover:bg-slate-50/40"
                  )}
                >
                <td className="py-3 pl-4 pr-2">
                  <span
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full text-sm font-extrabold tabular-nums",
                      position === 1
                        ? "bg-amber-400 text-amber-950"
                        : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {position}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  {row ? (
                    <>
                      <p className="font-semibold text-slate-900">#{row.trackPosition} · {row.riderName}</p>
                      <p className="font-mono text-xs text-slate-400">{row.registrationNumber}</p>
                    </>
                  ) : (
                    <p className="font-semibold text-slate-500">Puesto desierto</p>
                  )}
                </td>
                {showScoring && (
                  <td className="py-3 pr-3 text-right font-semibold tabular-nums text-slate-800">
                    {row ? row.scoreValue : "—"}
                  </td>
                )}
                {showScoring && (
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-600">
                    {row ? row.firstPlaceVotes : desertedRow?.votesCount ?? "—"}
                  </td>
                )}
                <td className="py-3 pr-4 text-right">
                  {desertedRow && !row ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      Desierto
                    </span>
                  ) : row?.status === "TIED" ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="size-3" />
                      Empate
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                        row?.status === "FINAL"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : provisionalVariant === "tieBreak"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      )}
                    >
                      {row?.status === "FINAL" ? "Oficial" : provisionalLabel}
                    </span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
