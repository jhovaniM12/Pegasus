"use client";

import { useMemo } from "react";
import { CheckCircle2, Loader2, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { RoundState, RoundType } from "@/types/staged-flow";
import { RoundRankingBoard } from "./round-ranking-board";
import { RoundSelectionGrid } from "./round-selection-grid";

const ROUND_TITLES: Record<RoundType, string> = {
  F1: "Tarjeta F1 — Cabeza de lote",
  F2: "Tarjeta F2 — Puestos finales",
  TIE_BREAK: "Tarjeta de desempate",
};

const ROUND_HINTS: Record<RoundType, string> = {
  F1: "Selecciona los ejemplares que pasan a la tarjeta final.",
  F2: "Asigna un puesto a cada ejemplar tocándolos en orden (1.º, 2.º, ...).",
  TIE_BREAK: "Reordena solo los ejemplares empatados tras la prueba opcional.",
};

type JudgeRoundWorkspaceProps = {
  stageId: string;
  round: RoundState;
  busy: boolean;
  onLocalUpdate: (round: RoundState) => void;
  runAction: (
    title: string,
    description: string,
    action: () => Promise<unknown>,
    variant?: "default" | "destructive"
  ) => void;
};

export function JudgeRoundWorkspace({
  stageId,
  round,
  busy,
  onLocalUpdate,
  runAction,
}: JudgeRoundWorkspaceProps) {
  const roundType = round.round.roundType;
  const isSelectionRound = roundType === "F1";
  const formStatus = round.form?.status ?? null;
  const editable = round.round.status === "OPEN" && formStatus === "STARTED";

  const selectedIds = useMemo(
    () => new Set(round.participants.filter((p) => p.selected).map((p) => p.id)),
    [round.participants]
  );

  const desertedPositions = useMemo(
    () => new Set(round.form?.desertedPositions ?? []),
    [round.form?.desertedPositions]
  );

  const assignedByParticipant = useMemo(
    () =>
      round.participants
        .filter((p) => p.position !== null)
        .map((p) => ({ participantId: p.id, position: p.position as number }))
        .sort((a, b) => a.position - b.position),
    [round.participants]
  );

  const persistSelection = (next: string[]) => {
    stagedFlowService
      .updateRoundForm(stageId, { selectedParticipantIds: next })
      .then((r) => r.data && onLocalUpdate(r.data));
  };

  const toggleSelect = (participantId: string) => {
    if (!editable) return;
    const next = selectedIds.has(participantId)
      ? [...selectedIds].filter((id) => id !== participantId)
      : [...selectedIds, participantId];
    if (next.length > (round.maxSelections ?? Infinity)) return;
    persistSelection(next);
  };

  const toggleRank = (participantId: string) => {
    if (!editable) return;
    const current = assignedByParticipant.find((row) => row.participantId === participantId);
    if (current) {
      stagedFlowService
        .updateRoundForm(stageId, {
          positions: assignedByParticipant
            .filter((row) => row.participantId !== participantId)
            .map((row) => ({ participantId: row.participantId, position: row.position })),
          desertedPositions: [...desertedPositions],
        })
        .then((r) => r.data && onLocalUpdate(r.data));
      return;
    }

    const total = round.participants.length;
    const assignedPositions = new Set(assignedByParticipant.map((row) => row.position));
    const nextPosition = Array.from({ length: total }, (_, index) => index + 1).find(
      (position) => !assignedPositions.has(position) && !desertedPositions.has(position)
    );
    if (!nextPosition) return;

    stagedFlowService
      .updateRoundForm(stageId, {
        positions: [...assignedByParticipant, { participantId, position: nextPosition }],
        desertedPositions: [...desertedPositions],
      })
      .then((r) => r.data && onLocalUpdate(r.data));
  };

  const toggleDesertedPosition = (position: number) => {
    if (!editable) return;
    const assignedPositions = new Set(assignedByParticipant.map((row) => row.position));
    if (assignedPositions.has(position)) return;
    const next = new Set(desertedPositions);
    if (next.has(position)) next.delete(position);
    else next.add(position);
    stagedFlowService
      .updateRoundForm(stageId, {
        positions: assignedByParticipant.map((row) => ({ participantId: row.participantId, position: row.position })),
        desertedPositions: [...next].sort((a, b) => a - b),
      })
      .then((r) => r.data && onLocalUpdate(r.data));
  };

  const total = round.participants.length;
  const progressLabel = isSelectionRound
    ? `${selectedIds.size} / ${round.maxSelections ?? total} seleccionados`
    : `${assignedByParticipant.length} con puesto · ${desertedPositions.size} desiertos`;

  const canClose = isSelectionRound
    ? true
    : assignedByParticipant.length + desertedPositions.size === total;

  // Estados de la ronda ajenos a la edición del juez.
  if (round.round.status !== "OPEN") {
    return (
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">{ROUND_TITLES[roundType]}</h2>
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-6 py-8 text-center">
          <CheckCircle2 className="size-8 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-900">Ronda consolidada</p>
          <p className="max-w-md text-sm text-slate-500">
            El Director Técnico consolidó esta ronda. Espera la siguiente fase o el resultado oficial.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{ROUND_TITLES[roundType]}</h2>
          <p className="text-sm text-slate-500">{progressLabel}</p>
        </div>
        {formStatus === "PENDING" && (
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={busy}
            onClick={() =>
              runAction("Iniciar tarjeta", ROUND_HINTS[roundType], () =>
                stagedFlowService.startRoundForm(stageId)
              )
            }
          >
            <Play className="size-4" />
            Iniciar tarjeta
          </Button>
        )}
        {formStatus === "STARTED" && (
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/50"
            disabled={busy || !canClose}
            onClick={() =>
              runAction(
                "Cerrar tarjeta",
                "Una vez cerrada no podrás modificarla. El Director Técnico será notificado.",
                () => stagedFlowService.closeRoundForm(stageId)
              )
            }
          >
            <Lock className="size-4" />
            Cerrar tarjeta
          </Button>
        )}
      </div>

      {formStatus === "STARTED" && (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">{ROUND_HINTS[roundType]}</p>
      )}

      {formStatus === "CLOSED" && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Tarjeta cerrada</p>
            <p className="text-xs text-emerald-700">
              Espera a que el Director Técnico consolide la ronda.
            </p>
            <span className="mt-1 inline-flex items-center gap-1.5 text-xs italic text-emerald-700/80">
              <Loader2 className="size-3.5 animate-spin" />
              Sincronizando en tiempo real...
            </span>
          </div>
        </div>
      )}

      {formStatus && formStatus !== "PENDING" && (
        <div className="mt-4">
          {isSelectionRound ? (
            <RoundSelectionGrid
              participants={round.participants}
              editable={editable}
              selectedIds={selectedIds}
              maxSelections={round.maxSelections ?? total}
              onToggle={toggleSelect}
            />
          ) : (
            <RoundRankingBoard
              participants={round.participants}
              editable={editable}
              desertedPositions={[...desertedPositions]}
              onToggleParticipant={toggleRank}
              onToggleDesertedPosition={toggleDesertedPosition}
            />
          )}
        </div>
      )}

      {formStatus === "PENDING" && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-slate-900">Tarjeta lista</p>
          <p className="mt-1 text-sm text-slate-500">Inicia tu tarjeta para comenzar a juzgar.</p>
        </div>
      )}
    </section>
  );
}
