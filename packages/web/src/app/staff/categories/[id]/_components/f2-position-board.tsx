"use client";

import { useState } from "react";

import { useAwardDistinctives } from "@/hooks/use-award-distinctives";
import { useToast } from "@/components/ui/toast";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { RoundParticipant, RoundState } from "@/types/staged-flow";
import { F1NoteDialog } from "./f1-note-dialog";
import { F1RemindersDialog } from "./f1-reminders-dialog";
import { RoundEntryCard } from "./round-entry-card";

type F2PositionBoardProps = {
  stageId: string;
  round: RoundState;
  editable: boolean;
  onAssignToPosition: (participantId: string, position: number) => void;
  onUnassign: (participantId: string) => void;
  allowedPositions: number[];
  onLocalUpdate: (round: RoundState) => void;
  onOpenDisqualify: (participant: RoundParticipant) => void;
  onSaveNote?: (participantId: string, note: string | null) => Promise<void>;
  onSaveReminders?: (
    participantId: string,
    reminders: Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>
  ) => Promise<void>;
};

export function F2PositionBoard({
  stageId,
  round,
  editable,
  onAssignToPosition,
  onUnassign,
  allowedPositions,
  onLocalUpdate,
  onOpenDisqualify,
  onSaveNote,
  onSaveReminders,
}: F2PositionBoardProps) {
  const { toast } = useToast();
  const { distinctives: awardDistinctives } = useAwardDistinctives();
  const [annotationBusy, setAnnotationBusy] = useState(false);
  const [remindersTarget, setRemindersTarget] = useState<RoundParticipant | null>(null);
  const [noteTarget, setNoteTarget] = useState<RoundParticipant | null>(null);

  const handleAnnotationError = () => {
    toast({
      variant: "error",
      title: "No se pudo guardar",
      description: "Intenta nuevamente en unos segundos.",
    });
  };

  const applyReminders = async (
    participantId: string,
    reminders: Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>
  ) => {
    setAnnotationBusy(true);
    try {
      if (onSaveReminders) {
        await onSaveReminders(participantId, reminders);
        return;
      }
      const response = await stagedFlowService.updateRoundEntryReminders(stageId, participantId, reminders);
      if (response.data) {
        onLocalUpdate(response.data);
      }
    } catch {
      handleAnnotationError();
    } finally {
      setAnnotationBusy(false);
    }
  };

  const saveNote = async (participantId: string, note: string | null) => {
    setAnnotationBusy(true);
    try {
      if (onSaveNote) {
        await onSaveNote(participantId, note);
        return;
      }
      const response = await stagedFlowService.updateRoundEntryNote(stageId, participantId, note);
      if (response.data) {
        onLocalUpdate(response.data);
      }
    } catch {
      handleAnnotationError();
    } finally {
      setAnnotationBusy(false);
    }
  };

  const eligible = round.participants.filter((p) => p.status === "ELIGIBLE");
  const disqualified = round.participants.filter((p) => p.status === "DISQUALIFIED");

  // Reorden visual desactivado: las tarjetas se quedan en orden de pista.
  // Lógica anterior (puestos asignados arriba, sin puesto abajo):
  // const sorted = [
  //   ...eligible.filter((p) => p.position !== null).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  //   ...eligible.filter((p) => p.position === null).sort((a, b) => a.trackPosition - b.trackPosition),
  // ];
  const sorted = [...eligible].sort((a, b) => a.trackPosition - b.trackPosition);
  const occupiedPositions = eligible
    .map((participant) => participant.position)
    .filter((position): position is number => position !== null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((participant) => (
          <RoundEntryCard
            key={participant.id}
            variant="f2"
            participant={participant}
            editable={editable}
            assignedPosition={participant.position}
            occupiedPositions={occupiedPositions}
            allowedPositions={allowedPositions}
            awardDistinctives={awardDistinctives}
            onAssignToPosition={onAssignToPosition}
            onUnassign={onUnassign}
            onOpenReminders={setRemindersTarget}
            onOpenNote={setNoteTarget}
            onOpenDisqualify={onOpenDisqualify}
          />
        ))}
      </div>

      {disqualified.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Descalificados</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {disqualified.map((participant) => (
              <RoundEntryCard
                key={participant.id}
                variant="f2"
                participant={participant}
                editable={false}
                assignedPosition={null}
                occupiedPositions={occupiedPositions}
                allowedPositions={allowedPositions}
                awardDistinctives={awardDistinctives}
                onAssignToPosition={() => undefined}
                onUnassign={() => undefined}
                onOpenReminders={() => undefined}
                onOpenNote={() => undefined}
                onOpenDisqualify={() => undefined}
              />
            ))}
          </div>
        </div>
      )}

      <F1RemindersDialog
        open={remindersTarget !== null}
        participant={remindersTarget}
        availableReminders={round.availableReminders}
        busy={annotationBusy}
        onOpenChange={(open) => { if (!open) setRemindersTarget(null); }}
        onApply={applyReminders}
      />

      <F1NoteDialog
        open={noteTarget !== null}
        participant={noteTarget}
        busy={annotationBusy}
        onOpenChange={(open) => { if (!open) setNoteTarget(null); }}
        onSave={saveNote}
      />
    </div>
  );
}
