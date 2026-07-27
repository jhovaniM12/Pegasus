"use client";

import { AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DesertedRoundResult,
  PositionOutcome,
  RoundResult,
  UnawardedRoundResult,
} from "@/types/staged-flow";
import { Cinta } from "@/components/cinta";

type OfficialResultBoardProps = {
  results: RoundResult[];
  desertedResults?: DesertedRoundResult[];
  unawardedResults?: UnawardedRoundResult[];
  positionOutcomes?: PositionOutcome[];
  /** F2 muestra suma de puestos; F1 solo conteo de votos. */
  showScoring?: boolean;
  title?: string;
  note?: string;
  provisionalLabel?: string;
  provisionalVariant?: "neutral" | "tieBreak";
  forceOfficialStatus?: boolean;
};

function resolveOutcomes({
  desertedResults,
  unawardedResults,
  positionOutcomes,
}: {
  desertedResults: DesertedRoundResult[];
  unawardedResults: UnawardedRoundResult[];
  positionOutcomes: PositionOutcome[];
}): PositionOutcome[] {
  if (positionOutcomes.length > 0) return positionOutcomes;

  const desertedPositions = new Set(desertedResults.map((row) => row.finalPosition));

  return [
    ...desertedResults.map((row) => ({
      finalPosition: row.finalPosition,
      outcomeType: "DESERTED" as const,
      participantId: null,
      assignedVotes: row.assignedVotes ?? 0,
      minimumRequired: row.minimumRequired ?? null,
      votesCount: row.desertedVotes ?? row.votesCount,
      desertedVotes: row.desertedVotes ?? row.votesCount,
      reason: row.reason ?? null,
      awardDistinctive: row.awardDistinctive,
    })),
    // Históricos: se muestran como Desierto con causa de consideración insuficiente.
    ...unawardedResults
      .filter((row) => !desertedPositions.has(row.finalPosition))
      .map((row) => ({
        finalPosition: row.finalPosition,
        outcomeType: "DESERTED" as const,
        participantId: null,
        assignedVotes: row.assignedVotes,
        minimumRequired: row.minimumRequired,
        votesCount: 0,
        desertedVotes: 0,
        reason: "INSUFFICIENT_CONSIDERATION" as const,
        awardDistinctive: row.awardDistinctive,
      })),
  ].sort((a, b) => a.finalPosition - b.finalPosition);
}

function outcomeLabel(outcome: PositionOutcome): string {
  switch (outcome.outcomeType) {
    case "DESERTED":
      return "Puesto desierto";
    case "UNAWARDED_INSUFFICIENT_CONSIDERATION":
      return "Puesto desierto";
    case "TIE_BREAK_REQUIRED":
      return outcome.tieBreakReason === "FIFTH_PLACE_EXCEPTION_5E"
        ? "Desempate para definir quinto puesto (5.e)"
        : "Empate por suma";
    default: {
      const _exhaustive: never = outcome.outcomeType;
      return _exhaustive;
    }
  }
}

function desertedReasonDescription(outcome: PositionOutcome): string {
  switch (outcome.reason) {
    case "NO_ASSIGNMENTS":
      return "Ningún juez asignó ejemplar a este puesto";
    case "EXPLICIT_MAJORITY":
      return "Mayoría de jueces dejó el puesto desierto";
    case "INSUFFICIENT_CONSIDERATION": {
      const assigned = outcome.assignedVotes;
      const required = outcome.minimumRequired;
      if (required != null) {
        return `Ningún ejemplar alcanzó la consideración mínima (${assigned}/${required})`;
      }
      return "Ningún ejemplar alcanzó la consideración mínima";
    }
    default:
      return "Ningún juez asignó este puesto con consideración suficiente";
  }
}

function outcomeDescription(outcome: PositionOutcome): string | null {
  switch (outcome.outcomeType) {
    case "DESERTED":
      return desertedReasonDescription(outcome);
    case "UNAWARDED_INSUFFICIENT_CONSIDERATION":
      return desertedReasonDescription({
        ...outcome,
        outcomeType: "DESERTED",
        reason: "INSUFFICIENT_CONSIDERATION",
      });
    case "TIE_BREAK_REQUIRED":
      return outcome.tieBreakReason === "FIFTH_PLACE_EXCEPTION_5E"
        ? "Quintos distintos pendientes de desempate"
        : "Suma empatada pendiente de desempate";
    default: {
      const _exhaustive: never = outcome.outcomeType;
      return _exhaustive;
    }
  }
}

function outcomeBadgeLabel(outcome: PositionOutcome): string {
  switch (outcome.outcomeType) {
    case "DESERTED":
      return "Desierto";
    case "UNAWARDED_INSUFFICIENT_CONSIDERATION":
      return "Desierto";
    case "TIE_BREAK_REQUIRED":
      return outcome.tieBreakReason === "FIFTH_PLACE_EXCEPTION_5E"
        ? "Desempate 5.e"
        : "Empate por suma";
    default: {
      const _exhaustive: never = outcome.outcomeType;
      return _exhaustive;
    }
  }
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

function unresolvedTieMembership(row: RoundResult) {
  return (row.tieMembership ?? []).find((block) => !block.resolved) ?? null;
}

function StatusBadge({
  row,
  outcome,
  provisionalLabel,
  provisionalVariant,
  forceOfficialStatus,
}: {
  row?: RoundResult;
  outcome?: PositionOutcome;
  provisionalLabel: string;
  provisionalVariant: "neutral" | "tieBreak";
  forceOfficialStatus: boolean;
}) {
  if (forceOfficialStatus) return null;

  if (outcome && !row) {
    return (
      <span className="mt-1.5 inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
        {outcomeBadgeLabel(outcome)}
      </span>
    );
  }
  if (row?.resolvedByTieBreak) {
    return (
      <span className="mt-1.5 inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        Resuelto por desempate
      </span>
    );
  }
  if (row?.status === "FINAL") {
    return null;
  }

  const pendingTie = row ? unresolvedTieMembership(row) : null;
  if (pendingTie?.reason === "FIFTH_PLACE_EXCEPTION_5E") {
    return (
      <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800">
        <AlertTriangle className="size-3" />
        Desempate para definir quinto puesto (5.e)
      </span>
    );
  }
  if (pendingTie?.reason === "SUM_EQUALITY") {
    return (
      <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        <AlertTriangle className="size-3" />
        Empate por suma
      </span>
    );
  }

  if (row && (row.finalPosition == null || row.finalPosition > 5) && !row.awardDistinctive) {
    return (
      <span className="mt-1.5 inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
        Sin premio
      </span>
    );
  }

  if (provisionalVariant === "tieBreak") {
    return (
      <span className="mt-1.5 inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        {provisionalLabel}
      </span>
    );
  }

  return null;
}

export function OfficialResultBoard({
  results,
  desertedResults = [],
  unawardedResults = [],
  positionOutcomes = [],
  showScoring = true,
  title = "Resultado F2",
  note,
  provisionalLabel = "Provisional",
  provisionalVariant = "neutral",
  forceOfficialStatus = false,
}: OfficialResultBoardProps) {
  const outcomes = resolveOutcomes({ desertedResults, unawardedResults, positionOutcomes });

  if (results.length === 0 && outcomes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">
        Aún no hay resultados consolidados.
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => (a.finalPosition ?? 0) - (b.finalPosition ?? 0));
  const outcomeByPosition = new Map(outcomes.map((row) => [row.finalPosition, row]));
  const maxPosition = Math.max(
    0,
    ...sorted.map((row) => row.finalPosition ?? 0),
    ...outcomes.map((row) => row.finalPosition)
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
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-slate-200/60 bg-slate-50/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="w-20 py-2.5 pl-4 pr-2 text-center sm:w-24">Puesto</th>
              <th className="py-2.5 pr-3 text-left">Ejemplar</th>
              <th className="w-36 py-2.5 pr-3 text-center sm:w-44 md:w-52">Distintivo</th>
              {showScoring && <th className="w-16 py-2.5 pr-4 text-center sm:w-20 md:w-24">Suma</th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxPosition }, (_, index) => index + 1).map((position) => {
              const row = sorted.find((result) => result.finalPosition === position);
              const outcome = outcomeByPosition.get(position);
              const displayOutcome =
                row && outcome?.outcomeType === "TIE_BREAK_REQUIRED" ? undefined : outcome;
              if (!row && !displayOutcome) return null;

              const pendingTie = row && !forceOfficialStatus ? unresolvedTieMembership(row) : null;
              const isTiedRow = Boolean(pendingTie);
              const isDeserted = displayOutcome?.outcomeType === "DESERTED";

              return (
                <tr
                  key={row?.id ?? `outcome-${displayOutcome?.outcomeType}-${position}`}
                  className={cn(
                    "border-b border-slate-100 text-sm last:border-0",
                    pendingTie?.reason === "FIFTH_PLACE_EXCEPTION_5E"
                      ? "bg-violet-50/50"
                      : isTiedRow
                        ? "bg-amber-50/60"
                        : displayOutcome
                          ? "bg-slate-50/70"
                          : "hover:bg-slate-50/40"
                  )}
                >
                  <td className="py-3 pl-4 pr-2 text-center align-middle">
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm font-extrabold tabular-nums text-slate-700">
                      {position}
                    </span>
                  </td>

                  <td className="py-3 pr-3 align-middle">
                    {row ? (
                      <>
                        <p className="truncate font-semibold text-slate-900">
                          #{row.trackPosition} · {row.riderName}
                        </p>
                        <p className="truncate font-mono text-xs text-slate-400">
                          {row.registrationNumber}
                        </p>
                        <StatusBadge
                          row={row}
                          outcome={displayOutcome}
                          provisionalLabel={provisionalLabel}
                          provisionalVariant={provisionalVariant}
                          forceOfficialStatus={forceOfficialStatus}
                        />
                      </>
                    ) : displayOutcome ? (
                      <>
                        <p className="font-semibold text-slate-500">{outcomeLabel(displayOutcome)}</p>
                        {outcomeDescription(displayOutcome) && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {outcomeDescription(displayOutcome)}
                          </p>
                        )}
                      </>
                    ) : null}
                  </td>

                  <td className="py-3 pr-3 align-middle">
                    <div className="flex justify-center">
                      <DistinctiveBadge
                        distinctive={
                          row?.awardDistinctive ?? displayOutcome?.awardDistinctive ?? null
                        }
                        deserted={Boolean(isDeserted && !row)}
                      />
                    </div>
                  </td>

                  {showScoring && (
                    <td className="py-3 pr-4 text-center align-middle font-semibold tabular-nums text-slate-800">
                      {row ? row.scoreValue : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
