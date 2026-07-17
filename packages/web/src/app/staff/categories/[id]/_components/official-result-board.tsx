"use client";

import { AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesertedRoundResult, RoundResult } from "@/types/staged-flow";
import { Cinta } from "@/components/cinta";

type OfficialResultBoardProps = {
  results: RoundResult[];
  desertedResults?: DesertedRoundResult[];
  /** F2 muestra suma de puestos y primeros lugares; F1 solo conteo de votos. */
  showScoring?: boolean;
  /** Podio visual (top 3). Solo para resultado oficial cerrado. */
  showPodium?: boolean;
  title?: string;
  note?: string;
  provisionalLabel?: string;
  provisionalVariant?: "neutral" | "tieBreak";
  forceOfficialStatus?: boolean;
};

const POSITION_STYLES = {
  1: {
    podiumBar: "bg-gradient-to-b from-amber-400 to-amber-500 h-28",
    podiumLabel: "text-amber-950",
    medal: "🥇",
  },
  2: {
    podiumBar: "bg-gradient-to-b from-slate-300 to-slate-400 h-20",
    podiumLabel: "text-slate-800",
    medal: "🥈",
  },
  3: {
    podiumBar: "bg-gradient-to-b from-amber-700/80 to-amber-800/80 h-14",
    podiumLabel: "text-amber-100",
    medal: "🥉",
  },
} as const;

function positionStyle(position: number) {
  return POSITION_STYLES[position as keyof typeof POSITION_STYLES] ?? null;
}

function DistinctiveBadge({
  distinctive,
  deserted,
}: {
  distinctive: { label: string; colorHex: string | null } | null;
  deserted?: boolean;
}) {
  if (!distinctive) {
    return <Cinta text="Sin cinta" variant="sin_cinta" />;
  }

  const text = deserted ? `${distinctive.label} · Desierta` : distinctive.label;
  return <Cinta text={text} colorHex={distinctive.colorHex} />;
}

type PodiumSlot = {
  position: number;
  result?: RoundResult;
  deserted?: DesertedRoundResult;
};

function PodiumCard({ slot }: { slot: PodiumSlot }) {
  const { position, result, deserted } = slot;
  const style = positionStyle(position);
  if (!style) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full max-w-[170px] rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
        <p className="text-2xl leading-none">{style.medal}</p>
        {result ? (
          <>
            <p className="mt-1.5 text-base font-extrabold tabular-nums text-slate-900">
              #{result.trackPosition}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight text-slate-700">
              {result.riderName.split(" ").slice(0, 2).join(" ")}
            </p>
            <div className="mt-2 flex justify-center">
              <DistinctiveBadge distinctive={result.awardDistinctive} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-slate-400">{result.registrationNumber}</p>
          </>
        ) : deserted ? (
          <p className="mt-2 text-xs font-semibold text-slate-500">Puesto desierto</p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">—</p>
        )}
      </div>
      <div
        className={cn(
          "flex w-full max-w-[170px] items-end justify-center rounded-t-lg pb-2",
          style.podiumBar
        )}
      >
        <span className={cn("text-2xl font-black tabular-nums opacity-70", style.podiumLabel)}>
          {position}
        </span>
      </div>
    </div>
  );
}

function Podium({
  sorted,
  desertedByPosition,
}: {
  sorted: RoundResult[];
  desertedByPosition: Map<number, DesertedRoundResult>;
}) {
  const slot = (pos: number): PodiumSlot => ({
    position: pos,
    result: sorted.find((r) => r.finalPosition === pos),
    deserted: desertedByPosition.get(pos),
  });

  const hasAnyTop3 =
    sorted.some((r) => r.finalPosition !== null && r.finalPosition <= 3) ||
    [1, 2, 3].some((p) => desertedByPosition.has(p));

  if (!hasAnyTop3) return null;

  return (
    <div className="px-5 pt-5 pb-2">
      <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Podio
      </p>
      <div className="flex items-end justify-center gap-2 sm:gap-4">
        <PodiumCard slot={slot(2)} />
        <PodiumCard slot={slot(1)} />
        <PodiumCard slot={slot(3)} />
      </div>
    </div>
  );
}

function StatusBadge({
  row,
  desertedRow,
  provisionalLabel,
  provisionalVariant,
  forceOfficialStatus,
}: {
  row?: RoundResult;
  desertedRow?: DesertedRoundResult;
  provisionalLabel: string;
  provisionalVariant: "neutral" | "tieBreak";
  forceOfficialStatus: boolean;
}) {
  if (desertedRow && !row) {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
        Desierto
      </span>
    );
  }
  if (row && forceOfficialStatus) {
    return (
      <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Oficial
      </span>
    );
  }
  if (row?.resolvedByTieBreak) {
    return (
      <span className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        Resuelto por desempate
      </span>
    );
  }
  if (row?.status === "FINAL") {
    return (
      <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Oficial
      </span>
    );
  }
  if (row?.status === "TIED" && (row.finalPosition == null || row.finalPosition <= 5)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        <AlertTriangle className="size-3" />
        Empate
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
        provisionalVariant === "tieBreak"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {provisionalLabel}
    </span>
  );
}

export function OfficialResultBoard({
  results,
  desertedResults = [],
  showScoring = true,
  showPodium = false,
  title = "Resultado F2",
  note,
  provisionalLabel = "Provisional",
  provisionalVariant = "neutral",
  forceOfficialStatus = false,
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
  const hasTop3 =
    sorted.some((row) => row.finalPosition !== null && row.finalPosition <= 3) ||
    [1, 2, 3].some((position) => desertedByPosition.has(position));

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

      {showPodium && hasTop3 && (
        <>
          <Podium sorted={sorted} desertedByPosition={desertedByPosition} />
          <div className="mx-5 border-t border-slate-100" />
        </>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left">
          <thead>
            <tr className="border-b border-slate-200/60 bg-slate-50/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="w-14 py-2.5 pl-4 pr-2">Puesto</th>
              <th className="py-2.5 pr-3">Ejemplar</th>
              <th className="py-2.5 pr-3 text-center">Distintivo</th>
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

              const isTied = row?.status === "TIED" && !forceOfficialStatus;

              return (
                <tr
                  key={row?.id ?? `deserted-${position}`}
                  className={cn(
                    "border-b border-slate-100 text-sm last:border-0",
                    isTied
                      ? "bg-amber-50/60"
                      : desertedRow
                        ? "bg-slate-50/70"
                        : "hover:bg-slate-50/40"
                  )}
                >
                  <td className="py-3 pl-4 pr-2">
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm font-extrabold tabular-nums text-slate-700">
                      {position}
                    </span>
                  </td>

                  <td className="py-3 pr-3">
                    {row ? (
                      <>
                        <p className="font-semibold text-slate-900">
                          #{row.trackPosition} · {row.riderName}
                        </p>
                        <p className="font-mono text-xs text-slate-400">{row.registrationNumber}</p>
                      </>
                    ) : (
                      <p className="font-semibold text-slate-500">Puesto desierto</p>
                    )}
                  </td>

                  <td className="py-3 pr-3">
                    <div className="flex justify-center">
                      <DistinctiveBadge
                        distinctive={row?.awardDistinctive ?? desertedRow?.awardDistinctive ?? null}
                        deserted={Boolean(desertedRow && !row)}
                      />
                    </div>
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
                    <StatusBadge
                      row={row}
                      desertedRow={desertedRow}
                      provisionalLabel={provisionalLabel}
                      provisionalVariant={provisionalVariant}
                      forceOfficialStatus={forceOfficialStatus}
                    />
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
