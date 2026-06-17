"use client";

import { ArrowRight, CheckCheck, CheckCircle2, Clock, Flag, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stagedFlowService } from "@/services/staged-flow.service";
import type {
  RoundManagementItem,
  StagedCategory,
  TieBreakTestType,
} from "@/types/staged-flow";
import { OfficialResultBoard } from "./official-result-board";
import { TieBreakPanel } from "./tie-break-panel";

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

function RoundFormsProgress({ round }: { round: RoundManagementItem }) {
  const closed = round.forms.filter((form) => form.status === "CLOSED").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">Tarjetas cerradas</span>
        <span className="font-semibold text-slate-900">
          {closed}/{round.forms.length}
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

  // FA consolidado → abrir F1 o F2 (el backend decide según sobrevivientes).
  if (status === "FA_CONSOLIDATED") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-blue-600" />
          <h3 className="text-base font-semibold text-slate-950">FA consolidado</h3>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Abre la siguiente ronda reglamentaria. Si quedan más de 8 ejemplares se abrirá F1 (cabeza de lote); de lo
          contrario, F2 (tarjeta final).
        </p>
        <Button
          className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
          disabled={busy}
          onClick={() =>
            runAction("Abrir siguiente ronda", "Se notificará a los jueces para diligenciar sus tarjetas.", () =>
              stagedFlowService.openNextRound(stageId)
            )
          }
        >
          <ArrowRight className="size-4" />
          Abrir siguiente ronda
        </Button>
      </div>
    );
  }

  // F1 en progreso → consolidar cuando todos cierren.
  if (status === "F1_IN_PROGRESS" && f1) {
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-950">F1 — Cabeza de lote</h3>
        <RoundFormsProgress round={f1} />
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
      </div>
    );
  }

  // F1 consolidado → abrir F2.
  if (status === "F1_CONSOLIDATED") {
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        {f1 && (
          <OfficialResultBoard
            results={f1.results}
            desertedResults={f1.desertedResults}
            showScoring={false}
            title="F1 — Cabeza de lote"
          />
        )}
        <Button
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          disabled={busy}
          onClick={() =>
            runAction("Abrir F2", "Los jueces asignarán puestos finales a los ejemplares de cabeza de lote.", () =>
              stagedFlowService.openNextRound(stageId)
            )
          }
        >
          <ArrowRight className="size-4" />
          Abrir tarjeta final F2
        </Button>
      </div>
    );
  }

  // F2 en progreso (abierta o consolidada con/ sin empate).
  if (status === "F2_IN_PROGRESS" && f2) {
    if (f2.status === "OPEN") {
      return (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-950">F2 — Tarjeta final</h3>
          <RoundFormsProgress round={f2} />
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
        </div>
      );
    }

    const hasTie = f2.results.some((row) => row.status === "TIED");
    const tiedCount = f2.results.filter((row) => row.status === "TIED").length;
    const resolvedByTieBreak =
      !hasTie && rounds.some((round) => round.roundType === "TIE_BREAK" && round.status === "CONSOLIDATED");
    return (
      <div className="space-y-4">
        <OfficialResultBoard
          results={f2.results}
          desertedResults={f2.desertedResults}
          title={resolvedByTieBreak ? "Resultado F2 tras desempate" : "Resultado F2"}
          note={
            resolvedByTieBreak
              ? "La suma y los primeros puestos corresponden al F2 original; el orden final fue definido por la ronda de desempate."
              : undefined
          }
          provisionalLabel={resolvedByTieBreak ? "Resuelto por desempate" : undefined}
          provisionalVariant={resolvedByTieBreak ? "tieBreak" : "neutral"}
        />
        {hasTie ? (
          <TieBreakPanel busy={busy} tiedCount={tiedCount} onOpen={onOpenTieBreak} />
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
    return (
      <OfficialResultBoard
        results={f2.results}
        desertedResults={f2.desertedResults}
        showPodium
        title="Resultado oficial"
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
