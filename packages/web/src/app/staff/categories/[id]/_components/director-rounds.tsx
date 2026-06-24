"use client";

import type { ReactNode } from "react";
import { CheckCheck, CheckCircle2, Clock, Flag, Gavel, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stagedFlowService } from "@/services/staged-flow.service";
import type {
  RoundManagementItem,
  RoundResult,
  StagedCategory,
  TieBreakTestType,
} from "@/types/staged-flow";
import { buildOfficialF2Results } from "./official-f2-results";
import { OfficialResultBoard } from "./official-result-board";
import { TieBreakPanel, type TieBlockInfo } from "./tie-break-panel";

type DirectorRoundsProps = {
  stageId: string;
  summary: StagedCategory;
  rounds: RoundManagementItem[];
  busy: boolean;
  runAction: (
    title: string,
    description: string,
    action: () => Promise<unknown>,
    variant?: "default" | "destructive"
  ) => void;
  onOpenTieBreak: (testTypes: TieBreakTestType[]) => void;
};

function latestOfType(rounds: RoundManagementItem[], type: RoundManagementItem["roundType"]) {
  return [...rounds].reverse().find((round) => round.roundType === type) ?? null;
}

function allFormsClosed(round: RoundManagementItem | null): boolean {
  return Boolean(round && round.forms.length > 0 && round.forms.every((form) => form.status === "CLOSED"));
}

function tieBlockKey(participantIds: string[]): string {
  return [...participantIds].sort().join("|");
}

function getBlockingTieBlocks(results: RoundResult[]): RoundResult[][] {
  const byScore = new Map<number, RoundResult[]>();
  for (const result of results) {
    if (result.status !== "TIED") continue;
    const group = byScore.get(result.scoreValue) ?? [];
    group.push(result);
    byScore.set(result.scoreValue, group);
  }

  return [...byScore.values()]
    .filter((group) => {
      if (group.length < 2) return false;
      const startPosition = Math.min(...group.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
      return startPosition <= 5;
    })
    .sort((a, b) => {
      const startA = Math.min(...a.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
      const startB = Math.min(...b.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
      return startA - startB;
    });
}

function getResolvedTieBlockKeys(rounds: RoundManagementItem[]): Set<string> {
  const resolved = new Set<string>();
  for (const round of rounds) {
    if (round.roundType !== "TIE_BREAK" || round.status !== "CONSOLIDATED") continue;
    if (round.results.some((result) => result.status === "TIED")) continue;

    const participantIds = new Set<string>();
    for (const form of round.forms) {
      for (const entry of form.entries) {
        participantIds.add(entry.participantId);
      }
    }
    if (participantIds.size > 1) {
      resolved.add(tieBlockKey([...participantIds]));
    }
  }
  return resolved;
}

function roundFormStatusBadge(status: RoundManagementItem["forms"][number]["status"]) {
  if (status === "CLOSED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="size-3" />
        Cerrado
      </span>
    );
  }
  if (status === "STARTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        <Gavel className="size-3" />
        En progreso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
      <Clock className="size-3" />
      Pendiente
    </span>
  );
}

function DirectorActiveRoundCard({
  roundType,
  round,
  children,
}: {
  roundType: "F1" | "F2";
  round: RoundManagementItem;
  children: ReactNode;
}) {
  const closedForms = round.forms.filter((form) => form.status === "CLOSED").length;
  const totalForms = round.forms.length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200/60 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-4.5 text-slate-600" />
          <span className="text-base font-semibold text-slate-800">Formato {roundType}</span>
        </div>
        <span className="flex items-center gap-1.5 rounded border border-slate-200/40 bg-slate-100 px-2 py-1 text-xs text-slate-700">
          Jueces cerrados:{" "}
          <strong className="font-semibold">
            {closedForms}/{totalForms}
          </strong>
        </span>
      </div>

      <div className="border-b border-slate-200/60 bg-slate-50/40 px-5 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Jueces</p>
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
                </div>
                <div className="shrink-0 self-start sm:self-center">{roundFormStatusBadge(form.status)}</div>
              </div>
            ))
        )}
      </div>

      <div className="border-t border-slate-200/60 bg-slate-50/40 p-5">{children}</div>
    </div>
  );
}

function RoundFormsProgress({ round }: { round: RoundManagementItem }) {
  const closed = round.forms.filter((form) => form.status === "CLOSED").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">Jueces</span>
        <span className="font-semibold text-slate-900">
          {closed}/{round.forms.length} cerrados
        </span>
      </div>
      <ul className="space-y-1.5">
        {round.forms.map((form) => (
          <li
            key={form.id}
            className="flex items-center justify-between rounded-md border border-slate-200/60 bg-slate-50/40 px-3 py-2 text-sm"
          >
            <span className="truncate text-slate-700">{form.judgeName}</span>
            {form.status === "CLOSED" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3.5" /> Cerrada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <Clock className="size-3.5" /> {form.status === "STARTED" ? "En progreso" : "Pendiente"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DirectorRounds({
  stageId,
  summary,
  rounds,
  busy,
  runAction,
  onOpenTieBreak,
}: DirectorRoundsProps) {
  const status = summary.status;
  const f1 = latestOfType(rounds, "F1");
  const f2 = latestOfType(rounds, "F2");
  const tieBreak = latestOfType(rounds, "TIE_BREAK");
  const activeTieBreakOpen = tieBreak?.status === "OPEN" ? tieBreak : null;

  // FA consolidado: el botón vive en la tarjeta Formato FA (ManagementView).
  if (status === "FA_CONSOLIDATED") {
    return null;
  }

  // F1 en progreso → consolidar cuando todos cierren.
  if (status === "F1_IN_PROGRESS" && f1) {
    return (
      <DirectorActiveRoundCard roundType="F1" round={f1}>
        <Button
          className="w-full bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-500/50"
          disabled={busy || !allFormsClosed(f1)}
          onClick={() =>
            runAction("Consolidar F1", "Se calcularán los ejemplares que pasan a la tarjeta final F2.", () =>
              stagedFlowService.consolidateRound(stageId)
            )
          }
        >
          <CheckCheck className="size-4" />
          Consolidar F1
        </Button>
      </DirectorActiveRoundCard>
    );
  }

  // F1 consolidado: la activación de F2 vive en ManagementView (ActivateRoundCard).
  if (status === "F1_CONSOLIDATED") {
    return null;
  }

  // F2 en progreso (abierta o consolidada con/ sin empate).
  if (status === "F2_IN_PROGRESS" && f2) {
    if (f2.status === "OPEN") {
      return (
        <DirectorActiveRoundCard roundType="F2" round={f2}>
          <Button
            className="w-full bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-500/50"
            disabled={busy || !allFormsClosed(f2)}
            onClick={() =>
              runAction("Consolidar F2", "Se calculará el resultado oficial y se detectarán empates.", () =>
                stagedFlowService.consolidateRound(stageId)
              )
            }
          >
            <CheckCheck className="size-4" />
            Consolidar F2
          </Button>
        </DirectorActiveRoundCard>
      );
    }

    const resolvedTieBlockKeys = getResolvedTieBlockKeys(rounds);
    const pendingTieBlock =
      getBlockingTieBlocks(f2.results).find(
        (block) => !resolvedTieBlockKeys.has(tieBlockKey(block.map((row) => row.participantId)))
      ) ?? null;

    const blockInfo: TieBlockInfo | null = pendingTieBlock
      ? {
          startPosition: Math.min(...pendingTieBlock.map((row) => row.finalPosition ?? 0)),
          endPosition: Math.max(...pendingTieBlock.map((row) => row.finalPosition ?? 0)),
          trackPositions: pendingTieBlock.map((row) => row.trackPosition).sort((a, b) => a - b),
        }
      : null;

    return (
      <div className="space-y-4">
        {pendingTieBlock && blockInfo ? (
          <TieBreakPanel busy={busy} blockInfo={blockInfo} onOpen={onOpenTieBreak} />
        ) : (
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={busy}
            onClick={() =>
              runAction(
                "Cerrar resultado oficial",
                "El resultado quedará como oficial y la categoría se cerrará.",
                () => stagedFlowService.closeResults(stageId)
              )
            }
          >
            <Flag className="size-4" />
            Cerrar resultado oficial
          </Button>
        )}
      </div>
    );
  }

  // Desempate en curso → consolidar cuando todos cierren.
  if (status === "TIE_BREAK_IN_PROGRESS" && activeTieBreakOpen) {
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-950">
          Desempate #{activeTieBreakOpen.sequence}
        </h3>
        {activeTieBreakOpen.tests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeTieBreakOpen.tests.map((test) => (
              <span
                key={test.id}
                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
              >
                {test.label}
              </span>
            ))}
          </div>
        )}
        <RoundFormsProgress round={activeTieBreakOpen} />
        <Button
          className="w-full bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-500/50"
          disabled={busy || !allFormsClosed(activeTieBreakOpen)}
          onClick={() =>
            runAction("Consolidar desempate", "Se recalculará el orden de los ejemplares empatados.", () =>
              stagedFlowService.consolidateRound(stageId)
            )
          }
        >
          <CheckCheck className="size-4" />
          Consolidar desempate
        </Button>
      </div>
    );
  }

  // Resultado oficial cerrado.
  if (status === "JUDGING_CLOSED" && f2) {
    const officialF2 = buildOfficialF2Results(rounds);
    return (
      <OfficialResultBoard
        results={officialF2?.results ?? f2.results}
        desertedResults={officialF2?.desertedResults ?? f2.desertedResults}
        showPodium
        title="Resultado oficial"
        forceOfficialStatus
      />
    );
  }

  if (status === "JUDGING_DESERTED") {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-50 p-5 text-center">
        <p className="text-base font-semibold text-slate-800">Competencia desierta</p>
        <p className="mt-1 text-sm text-slate-600">
          El Director Técnico declaró esta categoría sin ejemplares premiables.
        </p>
      </div>
    );
  }

  return null;
}
