"use client";

import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoundManagementItem, StageStatus } from "@/types/staged-flow";

const F1_SURVIVOR_THRESHOLD = 8;

export type ActivateRoundConfig = {
  roundType: "F1" | "F2";
  sourceLabel: "FA" | "F1";
  finalistCount: number;
};

export function isFaStageComplete(status: StageStatus): boolean {
  return (
    status === "FA_CONSOLIDATED" ||
    status === "F1_IN_PROGRESS" ||
    status === "F1_CONSOLIDATED" ||
    status === "F2_IN_PROGRESS" ||
    status === "TIE_BREAK_IN_PROGRESS" ||
    status === "JUDGING_CLOSED" ||
    status === "JUDGING_DESERTED"
  );
}

export function resolveActivateRoundConfig(input: {
  status: string;
  consolidatedCount: number;
  f1ResultCount: number;
}): ActivateRoundConfig | null {
  if (input.status === "FA_CONSOLIDATED" || (input.status === "JUDGING_STARTED" && input.consolidatedCount > 0)) {
    return {
      roundType: input.consolidatedCount > F1_SURVIVOR_THRESHOLD ? "F1" : "F2",
      sourceLabel: "FA",
      finalistCount: input.consolidatedCount,
    };
  }

  if (input.status === "F1_CONSOLIDATED") {
    return {
      roundType: "F2",
      sourceLabel: "F1",
      finalistCount: input.f1ResultCount,
    };
  }

  return null;
}

function latestRoundOfType(rounds: RoundManagementItem[], roundType: "F1" | "F2") {
  return [...rounds].reverse().find((item) => item.roundType === roundType) ?? null;
}

export function resolveActiveRoundDisplay(
  status: StageStatus,
  rounds: RoundManagementItem[]
): { roundType: "F1" | "F2"; round: RoundManagementItem } | null {
  if (status === "F1_IN_PROGRESS") {
    const round = latestRoundOfType(rounds, "F1");
    return round ? { roundType: "F1", round } : null;
  }

  if (status === "F2_IN_PROGRESS") {
    const round = latestRoundOfType(rounds, "F2");
    return round ? { roundType: "F2", round } : null;
  }

  return null;
}

type ActivateRoundCardProps = {
  config: ActivateRoundConfig;
  busy?: boolean;
  onActivate: () => void;
  embedded?: boolean;
};

export function ActivateRoundCard({
  config,
  busy = false,
  onActivate,
  embedded = false,
}: ActivateRoundCardProps) {
  const { roundType, sourceLabel, finalistCount } = config;

  const content = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 shrink-0 text-slate-900" />
          <h3 className="text-base font-semibold text-slate-900">Formato {roundType}</h3>
        </div>
        <p className="text-sm text-slate-600">
          El Formato {roundType} aún no ha sido activado.
        </p>
        <p className="text-sm font-medium text-amber-700">
          Hay {finalistCount} finalistas de {sourceLabel}. Se requiere activar {roundType}.
        </p>
      </div>

      <Button
        className="shrink-0 gap-2 self-start bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/50 sm:self-center"
        disabled={busy}
        onClick={onActivate}
      >
        <Trophy className="size-4" />
        Activar {roundType}
      </Button>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-violet-200 bg-violet-50/70 shadow-sm">
      <div className="px-5 py-4">{content}</div>
    </div>
  );
}
