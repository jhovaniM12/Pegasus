"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Lock, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRoundForm } from "@/hooks/use-round-form";
import { hasBlockingMutationsForStage } from "@/offline/offline-repository";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { RoundParticipant, RoundState, RoundType } from "@/types/staged-flow";
import { F2PositionBoard } from "./f2-position-board";
import { F2PositionSummary } from "./f2-position-summary";
import { F1SelectionBoard } from "./f1-selection-board";
import { FaDisqualifyDialog } from "./fa-disqualify-dialog";

const ROUND_TITLES: Record<RoundType, string> = {
  F1: "Prueba individual P1 — Cabeza de lote",
  F2: "Prueba individual P2 — Puestos finales",
  TIE_BREAK: "Tarjeta de desempate",
};

const ROUND_HINTS: Record<RoundType, string> = {
  F1: "Selecciona los ejemplares que pasan a la tarjeta final.",
  F2: "Toca el botón de puesto en cada tarjeta para asignar la posición. Al insertar en un puesto ocupado los demás se desplazan. Los ejemplares sin puesto quedan desiertos.",
  TIE_BREAK:
    "Toca el botón de puesto en cada tarjeta para asignar la posición. Al insertar en un puesto ocupado los demás se desplazan. Los ejemplares sin puesto quedan desiertos.",
};

const MAX_F2_POSITIONS = 5;

function assignWithCascade(
  assignments: Array<{ participantId: string; position: number }>,
  participantId: string,
  targetPosition: number,
  allowedPositions: number[]
): Array<{ participantId: string; position: number }> {
  const without = assignments.filter((a) => a.participantId !== participantId);
  const allowedSet = new Set(allowedPositions);
  const maxPosition = allowedPositions.at(-1) ?? MAX_F2_POSITIONS;
  const targetIsOccupied = without.some((a) => a.position === targetPosition);
  const shifted = targetIsOccupied
    ? without.map((a) =>
        a.position >= targetPosition ? { ...a, position: a.position + 1 } : a
      )
    : without;
  const bounded = shifted.filter((a) => a.position <= maxPosition && allowedSet.has(a.position));
  return [...bounded, { participantId, position: targetPosition }];
}

function computeAutoDeserted(
  assignments: Array<{ participantId: string; position: number }>,
  allowedPositions: number[]
): number[] {
  const assignedSet = new Set(assignments.map((a) => a.position));
  // Solo puestos premiables (1..5) pueden declararse desiertos; el 6.º+ no es desierto.
  return allowedPositions.filter(
    (position) => !assignedSet.has(position) && position <= MAX_F2_POSITIONS
  );
}

type JudgeRoundWorkspaceProps = {
  stageId: string;
  userId: string | null;
  round: RoundState;
  busy: boolean;
  onLocalUpdate: (round: RoundState) => void;
  syncUnavailable?: boolean;
  runAction: (
    title: string,
    description: string,
    action: () => Promise<unknown>,
    variant?: "default" | "destructive",
    confirmText?: string,
    redirectTo?: string
  ) => void;
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

export function JudgeRoundWorkspace({
  stageId,
  userId,
  round,
  busy,
  onLocalUpdate,
  syncUnavailable = false,
  runAction,
}: JudgeRoundWorkspaceProps) {
  const { toast } = useToast();
  const roundType = round.round.roundType;
  const isSelectionRound = roundType === "F1";
  const formStatus = round.form?.status ?? null;
  const editable = round.round.status === "OPEN" && formStatus === "STARTED";
  const [localParticipants, setLocalParticipants] = useState(round.participants);
  const [localDesertedPositions, setLocalDesertedPositions] = useState(round.form?.desertedPositions ?? []);
  const [disqualifyTarget, setDisqualifyTarget] = useState<RoundParticipant | null>(null);
  const [disqualifyBusy, setDisqualifyBusy] = useState(false);
  const localParticipantsRef = useRef(round.participants);
  const localDesertedPositionsRef = useRef(round.form?.desertedPositions ?? []);
  const latestConfirmedRoundRef = useRef(round);
  const hasLocalPendingRef = useRef(false);

  const {
    pendingCount,
    hasBlockingPending,
    isSyncing,
    syncNow,
    queueFormSnapshot,
    queueNote,
    queueReminders,
    rememberServerRound,
    beginClose,
    endClose,
    buildCloseBody,
  } = useRoundForm({
    stageId,
    userId,
    round,
    onRoundChange: onLocalUpdate,
    onSyncNotice: (message) => {
      toast({ title: "Conflicto de sincronización", description: message, variant: "error" });
    },
  });

  useEffect(() => {
    hasLocalPendingRef.current = hasBlockingPending;
  }, [hasBlockingPending]);

  const eligibleParticipants = useMemo(
    () => localParticipants.filter((participant) => participant.status === "ELIGIBLE"),
    [localParticipants]
  );

  const selectedIds = useMemo(
    () =>
      new Set(
        localParticipants.filter((participant) => participant.selected && participant.status === "ELIGIBLE").map((p) => p.id)
      ),
    [localParticipants]
  );
  const consolidatedF1TrackPositions = useMemo(
    () =>
      localParticipants
        .filter((participant) => participant.selected && participant.status === "ELIGIBLE")
        .map((participant) => participant.trackPosition)
        .sort((a, b) => a - b),
    [localParticipants]
  );

  const assignedByParticipant = useMemo(
    () =>
      eligibleParticipants
        .filter((p) => p.position !== null)
        .map((p) => ({ participantId: p.id, position: p.position as number }))
        .sort((a, b) => a.position - b.position),
    [eligibleParticipants]
  );
  const allowedPositions = useMemo(() => {
    if (round.positionRange) {
      return Array.from(
        { length: round.positionRange.max - round.positionRange.min + 1 },
        (_, index) => round.positionRange!.min + index
      );
    }
    return Array.from({ length: Math.min(MAX_F2_POSITIONS, eligibleParticipants.length) }, (_, index) => index + 1);
  }, [eligibleParticipants.length, round.positionRange]);

  const positionSummaryItems = useMemo(() => {
    const trackByPosition = new Map(
      eligibleParticipants
        .filter((participant) => participant.position !== null)
        .map((participant) => [participant.position as number, participant.trackPosition])
    );
    const desertedSet = new Set(localDesertedPositions);

    return allowedPositions.map((position) => ({
      position,
      trackPosition: trackByPosition.get(position) ?? null,
      deserted: desertedSet.has(position),
    }));
  }, [allowedPositions, eligibleParticipants, localDesertedPositions]);

  const confirmDisqualify = async (participantId: string, reasonId: string) => {
    if (!editable) return;
    setDisqualifyBusy(true);
    try {
      const response = await stagedFlowService.disqualifyRoundParticipant(stageId, participantId, reasonId);
      if (response.data) {
        latestConfirmedRoundRef.current = response.data;
        localParticipantsRef.current = response.data.participants;
        localDesertedPositionsRef.current = response.data.form?.desertedPositions ?? [];
        setLocalParticipants(response.data.participants);
        setLocalDesertedPositions(response.data.form?.desertedPositions ?? []);
        setDisqualifyTarget(null);
        onLocalUpdate(response.data);
        void rememberServerRound(response.data);
        toast({ title: "Ejemplar descalificado", variant: "success" });
      }
    } catch (error) {
      toast({
        title: "No se pudo descalificar",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "error",
      });
      throw error;
    } finally {
      setDisqualifyBusy(false);
    }
  };

  useEffect(() => {
    latestConfirmedRoundRef.current = round;

    if (!hasLocalPendingRef.current) {
      localParticipantsRef.current = round.participants;
      localDesertedPositionsRef.current = round.form?.desertedPositions ?? [];
      setLocalParticipants(round.participants);
      setLocalDesertedPositions(round.form?.desertedPositions ?? []);
    }
  }, [round]);

  useEffect(() => {
    void rememberServerRound(round);
  }, [rememberServerRound, round.round.id, round.form?.id]);

  const toggleSelect = (participantId: string) => {
    if (!editable) return;

    const participant = localParticipantsRef.current.find((item) => item.id === participantId);
    if (!participant || participant.status === "DISQUALIFIED") return;

    const currentSelectedIds = localParticipantsRef.current
      .filter((item) => item.selected && item.status === "ELIGIBLE")
      .map((item) => item.id);
    const next = currentSelectedIds.includes(participantId)
      ? currentSelectedIds.filter((id) => id !== participantId)
      : [...currentSelectedIds, participantId];

    if (next.length > (round.maxSelections ?? Infinity)) return;

    const nextParticipants = syncParticipantsWithSelection(localParticipantsRef.current, next);
    localParticipantsRef.current = nextParticipants;
    setLocalParticipants(nextParticipants);
    void queueFormSnapshot({ selectedParticipantIds: next });
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
    void queueFormSnapshot({
      positions: nextPositions,
      desertedPositions: nextDesertedPositions,
    });
  };

  const getCurrentAssignments = () =>
    localParticipantsRef.current
      .filter((participant) => participant.status === "ELIGIBLE" && participant.position !== null)
      .map((participant) => ({ participantId: participant.id, position: participant.position as number }))
      .sort((a, b) => a.position - b.position);

  const assignParticipantToPosition = (participantId: string, targetPosition: number) => {
    if (!editable) return;
    const participant = localParticipantsRef.current.find((item) => item.id === participantId);
    if (!participant || participant.status === "DISQUALIFIED") return;
    const currentAssignments = getCurrentAssignments();
    if (!allowedPositions.includes(targetPosition)) return;
    const nextAssignments = assignWithCascade(currentAssignments, participantId, targetPosition, allowedPositions);
    persistRankingState(nextAssignments, computeAutoDeserted(nextAssignments, allowedPositions));
  };

  const unassignParticipantF2 = (participantId: string) => {
    if (!editable) return;
    const currentAssignments = getCurrentAssignments();
    const nextAssignments = currentAssignments.filter((row) => row.participantId !== participantId);
    persistRankingState(nextAssignments, computeAutoDeserted(nextAssignments, allowedPositions));
  };

  const totalEligible = eligibleParticipants.length;
  const isPositionBoardRound = roundType === "F2" || roundType === "TIE_BREAK";
  const progressLabel = isSelectionRound
    ? `${selectedIds.size} / ${round.maxSelections ?? totalEligible} seleccionados`
    : `${assignedByParticipant.length} / ${allowedPositions.length} puestos asignados`;

  const allTiedParticipantsRanked =
    roundType !== "TIE_BREAK" ||
    (totalEligible > 0 && assignedByParticipant.length === totalEligible);

  const canClose =
    (isSelectionRound || isPositionBoardRound) &&
    (roundType !== "TIE_BREAK" || allTiedParticipantsRanked) &&
    !hasBlockingPending &&
    !isSyncing;

  const closeRound = async () => {
    const closeBody = buildCloseBody();
    if (!closeBody) {
      throw new Error("No hay formulario de ronda para cerrar.");
    }

    beginClose();
    try {
      const syncResult = await syncNow();
      const stillBlocking =
        syncResult.conflicts > 0 ||
        syncResult.failed > 0 ||
        (userId ? await hasBlockingMutationsForStage(userId, stageId) : false);
      if (stillBlocking) {
        throw new Error(
          "No fue posible sincronizar la tarjeta. Revisa la conexión e intenta nuevamente antes de cerrar."
        );
      }

      const refreshedBody = buildCloseBody();
      if (!refreshedBody) {
        throw new Error("No hay formulario de ronda para cerrar.");
      }

      const response = await stagedFlowService.closeRoundForm(stageId, refreshedBody);
      if (response.data) {
        onLocalUpdate(response.data);
        void rememberServerRound(response.data);
      }
    } finally {
      endClose();
    }
  };

  // Estados de la ronda ajenos a la edición del juez.
  if (round.round.status !== "OPEN") {
    return (
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">{ROUND_TITLES[roundType]}</h2>
        {roundType === "F1" ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-900">Consolidado prueba individual P1</span>
            </div>
            <p className="mt-0.5 text-xs text-emerald-700">
              Finalistas consolidados: <strong>{consolidatedF1TrackPositions.length} ejemplares.</strong>
            </p>
            {consolidatedF1TrackPositions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {consolidatedF1TrackPositions.map((trackPosition) => (
                  <span
                    key={trackPosition}
                    className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 tabular-nums"
                  >
                    #{trackPosition}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-6 py-8 text-center">
            <CheckCircle2 className="size-8 text-emerald-600" />
            <p className="text-sm font-semibold text-slate-900">Ronda consolidada</p>
            <p className="max-w-md text-sm text-slate-500">
              El Director Técnico consolidó esta ronda. Espera la siguiente fase o el resultado oficial.
            </p>
          </div>
        )}
        {roundType === "F1" && formStatus !== "PENDING" && (
          <div className="mt-4">
            <F1SelectionBoard
              stageId={stageId}
              round={{ ...round, participants: localParticipants }}
              editable={false}
              selectedIds={selectedIds}
              maxSelections={round.maxSelections ?? totalEligible}
              onToggle={() => undefined}
              onLocalUpdate={() => undefined}
              onOpenDisqualify={() => undefined}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{ROUND_TITLES[roundType]}</h2>
          <p className="text-sm text-slate-500">{progressLabel}</p>
          {pendingCount > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              {isSyncing
                ? `Sincronizando ${pendingCount} cambio(s)…`
                : `${pendingCount} cambio(s) guardados en este dispositivo`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {pendingCount > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={isSyncing || busy}
              onClick={() => void syncNow()}
            >
              Sincronizar ahora
            </Button>
          )}
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
        </div>
      </div>

      {formStatus === "STARTED" && !isPositionBoardRound && (
        <div className="mt-3 space-y-2">
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">{ROUND_HINTS[roundType]}</p>
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
            {syncUnavailable ? (
              <span className="mt-1 inline-flex text-xs font-medium text-red-600">
                Sesión expirada. Vuelve a ingresar para actualizar la ronda.
              </span>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs italic text-emerald-700/80">
                <Loader2 className="size-3.5 animate-spin" />
                Sincronizando en tiempo real...
              </span>
            )}
          </div>
        </div>
      )}

      {formStatus && formStatus !== "PENDING" && (
        <div className="mt-4">
          {isSelectionRound ? (
            <F1SelectionBoard
              stageId={stageId}
              round={{ ...round, participants: localParticipants }}
              editable={editable}
              selectedIds={selectedIds}
              maxSelections={round.maxSelections ?? totalEligible}
              onToggle={toggleSelect}
              onLocalUpdate={(updated) => {
                latestConfirmedRoundRef.current = updated;
                localParticipantsRef.current = updated.participants;
                setLocalParticipants(updated.participants);
                onLocalUpdate(updated);
              }}
              onOpenDisqualify={setDisqualifyTarget}
              onSaveNote={queueNote}
              onSaveReminders={queueReminders}
            />
          ) : isPositionBoardRound ? (
            <F2PositionBoard
              stageId={stageId}
              round={{ ...round, participants: localParticipants }}
              editable={editable}
              onAssignToPosition={assignParticipantToPosition}
              onUnassign={unassignParticipantF2}
              allowedPositions={allowedPositions}
              onLocalUpdate={(updated) => {
                latestConfirmedRoundRef.current = updated;
                localParticipantsRef.current = updated.participants;
                localDesertedPositionsRef.current = updated.form?.desertedPositions ?? [];
                setLocalParticipants(updated.participants);
                setLocalDesertedPositions(updated.form?.desertedPositions ?? []);
                onLocalUpdate(updated);
              }}
              onOpenDisqualify={setDisqualifyTarget}
              onSaveNote={queueNote}
              onSaveReminders={queueReminders}
            />
          ) : null}
        </div>
      )}

      {formStatus === "STARTED" && (
        <div className="mt-6 space-y-3 border-t border-slate-200 pt-4">
          {isPositionBoardRound && (
            <F2PositionSummary
              items={positionSummaryItems}
              assignedCount={assignedByParticipant.length}
              totalPositions={allowedPositions.length}
            />
          )}
          <Button
            className="h-11 w-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 disabled:bg-blue-600/50"
            disabled={busy || !canClose}
            onClick={() =>
              runAction(
                roundType === "TIE_BREAK"
                  ? "Cerrar desempate"
                  : `Cerrar prueba individual ${roundType === "F1" ? "P1" : "P2"}`,
                "Una vez cerrado, no podrás modificar las posiciones asignadas. ¿Estás seguro de que deseas cerrar?",
                () => closeRound(),
                "default",
                "Cerrar prueba"
              )
            }
          >
            <Lock className="size-5" />
            {roundType === "TIE_BREAK"
              ? "Cerrar desempate"
              : `Cerrar prueba individual ${roundType === "F1" ? "P1" : "P2"}`}
          </Button>
          {hasBlockingPending && (
            <p className="mt-2 text-center text-xs text-amber-700">
              Tienes cambios guardados únicamente en este dispositivo. Debes sincronizarlos antes de
              cerrar la tarjeta.
            </p>
          )}
          {roundType === "TIE_BREAK" && !allTiedParticipantsRanked && (
            <p className="mt-2 text-center text-xs text-amber-700">
              Asigna un puesto a cada ejemplar empatado antes de cerrar ({assignedByParticipant.length}/
              {totalEligible}).
            </p>
          )}
        </div>
      )}

      <FaDisqualifyDialog
        open={disqualifyTarget !== null}
        participant={disqualifyTarget}
        reasons={round.disqualificationReasons}
        busy={disqualifyBusy}
        onOpenChange={(open) => {
          if (!open && !disqualifyBusy) setDisqualifyTarget(null);
        }}
        onConfirm={confirmDisqualify}
      />

      {formStatus === "PENDING" && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-slate-900">Tarjeta lista</p>
          <p className="mt-1 text-sm text-slate-500">Inicia tu tarjeta para comenzar a juzgar.</p>
        </div>
      )}
    </section>
  );
}
