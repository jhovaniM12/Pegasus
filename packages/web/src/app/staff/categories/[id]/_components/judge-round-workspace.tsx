"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { RoundParticipant, RoundState, RoundType } from "@/types/staged-flow";
import { RoundRankingBoard } from "./round-ranking-board";
import { RoundSelectionGrid } from "./round-selection-grid";

const ROUND_TITLES: Record<RoundType, string> = {
  F1: "Tarjeta F1 — Cabeza de lote",
  F2: "Tarjeta F2 — Puestos finales",
  TIE_BREAK: "Tarjeta de desempate",
};

const ROUND_HINTS: Record<RoundType, string> = {
  F1: "Selecciona los ejemplares que pasan a la tarjeta final.",
  F2: "Asigna un puesto a cada ejemplar. En 1.º a 5.º puedes declarar desierto; el ejemplar restante debe ubicarse en el siguiente puesto.",
  TIE_BREAK:
    "Asigna el orden de todos los empatados. En puestos premiables 1.º a 5.º puedes declarar desierto desde la fila del puesto.",
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

type RoundFormPayload = {
  selectedParticipantIds?: string[];
  positions?: Array<{ participantId: string; position: number }>;
  desertedPositions?: number[];
};

function syncParticipantsWithSelection(participants: RoundParticipant[], selectedIds: string[]): RoundParticipant[] {
  const selected = new Set(selectedIds);
  return participants.map((participant) => ({
    ...participant,
    selected: selected.has(participant.id),
  }));
}

function syncParticipantsWithPositions(
  participants: RoundParticipant[],
  positions: Array<{ participantId: string; position: number }>
): RoundParticipant[] {
  const positionByParticipant = new Map(positions.map((row) => [row.participantId, row.position]));
  return participants.map((participant) => ({
    ...participant,
    position: positionByParticipant.get(participant.id) ?? null,
  }));
}

function getNextAssignablePosition(
  assignments: Array<{ participantId: string; position: number }>,
  desertedPositions: number[],
  participantCount: number
): number | null {
  const assignedPositions = new Set(assignments.map((row) => row.position));
  const deserted = new Set(desertedPositions);
  const totalPositions = participantCount + deserted.size;

  return (
    Array.from({ length: totalPositions }, (_, index) => index + 1).find(
      (position) => !assignedPositions.has(position) && !deserted.has(position)
    ) ?? null
  );
}

export function JudgeRoundWorkspace({
  stageId,
  round,
  busy,
  onLocalUpdate,
  runAction,
}: JudgeRoundWorkspaceProps) {
  const { toast } = useToast();
  const roundType = round.round.roundType;
  const isSelectionRound = roundType === "F1";
  const formStatus = round.form?.status ?? null;
  const editable = round.round.status === "OPEN" && formStatus === "STARTED";
  const [localParticipants, setLocalParticipants] = useState(round.participants);
  const [localDesertedPositions, setLocalDesertedPositions] = useState(round.form?.desertedPositions ?? []);
  const localParticipantsRef = useRef(round.participants);
  const localDesertedPositionsRef = useRef(round.form?.desertedPositions ?? []);
  const pendingRoundPayloadRef = useRef<RoundFormPayload | null>(null);
  const isSyncingRoundRef = useRef(false);
  const latestConfirmedRoundRef = useRef(round);
  const latestRoundRequestIdRef = useRef(0);

  const selectedIds = useMemo(
    () => new Set(localParticipants.filter((p) => p.selected).map((p) => p.id)),
    [localParticipants]
  );

  const desertedPositions = useMemo(
    () => new Set(localDesertedPositions),
    [localDesertedPositions]
  );

  const assignedByParticipant = useMemo(
    () =>
      localParticipants
        .filter((p) => p.position !== null)
        .map((p) => ({ participantId: p.id, position: p.position as number }))
        .sort((a, b) => a.position - b.position),
    [localParticipants]
  );

  useEffect(() => {
    latestConfirmedRoundRef.current = round;

    // No permitas que una respuesta tardía pise una intención optimista más reciente.
    if (!isSyncingRoundRef.current && !pendingRoundPayloadRef.current) {
      localParticipantsRef.current = round.participants;
      localDesertedPositionsRef.current = round.form?.desertedPositions ?? [];
      setLocalParticipants(round.participants);
      setLocalDesertedPositions(round.form?.desertedPositions ?? []);
    }
  }, [round]);

  async function flushRoundPayload() {
    if (isSyncingRoundRef.current) return;

    const queuedPayload = pendingRoundPayloadRef.current;
    if (!queuedPayload) return;

    pendingRoundPayloadRef.current = null;
    isSyncingRoundRef.current = true;
    const requestId = ++latestRoundRequestIdRef.current;

    try {
      const response = await stagedFlowService.updateRoundForm(stageId, queuedPayload);
      if (requestId !== latestRoundRequestIdRef.current) {
        return;
      }

      if (response.data) {
        latestConfirmedRoundRef.current = response.data;
        if (!pendingRoundPayloadRef.current) {
          localParticipantsRef.current = response.data.participants;
          localDesertedPositionsRef.current = response.data.form?.desertedPositions ?? [];
          setLocalParticipants(response.data.participants);
          setLocalDesertedPositions(response.data.form?.desertedPositions ?? []);
        }
        onLocalUpdate(response.data);
      }
    } catch {
      if (requestId === latestRoundRequestIdRef.current) {
        const confirmedRound = latestConfirmedRoundRef.current;
        localParticipantsRef.current = confirmedRound.participants;
        localDesertedPositionsRef.current = confirmedRound.form?.desertedPositions ?? [];
        setLocalParticipants(confirmedRound.participants);
        setLocalDesertedPositions(confirmedRound.form?.desertedPositions ?? []);
        toast({
          title: "No se pudo guardar la tarjeta",
          description: "Se restauró la última selección confirmada. Intenta nuevamente.",
          variant: "error",
        });
      }
    } finally {
      isSyncingRoundRef.current = false;
      if (pendingRoundPayloadRef.current) {
        void flushRoundPayload();
      }
    }
  }

  const toggleSelect = (participantId: string) => {
    if (!editable) return;

    const currentSelectedIds = localParticipantsRef.current
      .filter((participant) => participant.selected)
      .map((participant) => participant.id);
    const next = currentSelectedIds.includes(participantId)
      ? currentSelectedIds.filter((id) => id !== participantId)
      : [...currentSelectedIds, participantId];

    if (next.length > (round.maxSelections ?? Infinity)) return;

    const nextParticipants = syncParticipantsWithSelection(localParticipantsRef.current, next);
    localParticipantsRef.current = nextParticipants;
    setLocalParticipants(nextParticipants);
    pendingRoundPayloadRef.current = { selectedParticipantIds: next };
    void flushRoundPayload();
  };

  const persistRankingState = (
    nextPositions: Array<{ participantId: string; position: number }>,
    nextDesertedPositions: number[]
  ) => {
    const nextParticipants = syncParticipantsWithPositions(localParticipantsRef.current, nextPositions);
    localParticipantsRef.current = nextParticipants;
    localDesertedPositionsRef.current = nextDesertedPositions;
    setLocalParticipants(nextParticipants);
    setLocalDesertedPositions(nextDesertedPositions);
    pendingRoundPayloadRef.current = {
      positions: nextPositions,
      desertedPositions: nextDesertedPositions,
    };
    void flushRoundPayload();
  };

  const getCurrentAssignments = () =>
    localParticipantsRef.current
      .filter((participant) => participant.position !== null)
      .map((participant) => ({ participantId: participant.id, position: participant.position as number }))
      .sort((a, b) => a.position - b.position);

  const assignParticipant = (participantId: string) => {
    if (!editable) return;
    const currentAssignments = getCurrentAssignments();
    const currentDesertedPositions = localDesertedPositionsRef.current;
    if (currentAssignments.some((row) => row.participantId === participantId)) return;

    const nextPosition = getNextAssignablePosition(
      currentAssignments,
      currentDesertedPositions,
      localParticipantsRef.current.length
    );
    if (!nextPosition) return;

    persistRankingState(
      [...currentAssignments, { participantId, position: nextPosition }],
      currentDesertedPositions
    );
  };

  const unassignParticipant = (participantId: string) => {
    if (!editable) return;
    const currentAssignments = getCurrentAssignments();
    persistRankingState(
      currentAssignments.filter((row) => row.participantId !== participantId),
      localDesertedPositionsRef.current
    );
  };

  const toggleDesertedPosition = (position: number) => {
    if (!editable) return;
    const currentAssignments = getCurrentAssignments();
    const currentDesertedPositions = localDesertedPositionsRef.current;
    const isDeserted = currentDesertedPositions.includes(position);

    if (isDeserted) {
      persistRankingState(
        currentAssignments.map((row) => ({
          ...row,
          position: row.position > position ? row.position - 1 : row.position,
        })),
        currentDesertedPositions.filter((row) => row !== position)
      );
      return;
    }

    persistRankingState(
      currentAssignments.filter((row) => row.position !== position),
      [...currentDesertedPositions, position].sort((a, b) => a - b)
    );
  };

  const total = localParticipants.length;
  const unrankedCount = total - assignedByParticipant.length;
  const progressLabel = isSelectionRound
    ? `${selectedIds.size} / ${round.maxSelections ?? total} seleccionados`
    : `${assignedByParticipant.length} / ${total} con puesto · ${desertedPositions.size} desiertos premiables`;

  const canClose = isSelectionRound
    ? true
    : assignedByParticipant.length === total;

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
        <div className="mt-3 space-y-2">
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">{ROUND_HINTS[roundType]}</p>
          {!isSelectionRound && unrankedCount > 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Faltan {unrankedCount} ejemplar{unrankedCount === 1 ? "" : "es"} por ubicar. No podrás cerrar la
              tarjeta hasta asignarles puesto.
            </p>
          )}
        </div>
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
              participants={localParticipants}
              editable={editable}
              selectedIds={selectedIds}
              maxSelections={round.maxSelections ?? total}
              onToggle={toggleSelect}
            />
          ) : (
            <RoundRankingBoard
              participants={localParticipants}
              editable={editable}
              desertedPositions={[...desertedPositions]}
              onAssignParticipant={assignParticipant}
              onUnassignParticipant={unassignParticipant}
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
