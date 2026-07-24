"use client";

import { useState } from "react";

import { useToast } from "@/components/ui/toast";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { RoundParticipant, RoundState } from "@/types/staged-flow";
import { F1EntryCard } from "./f1-entry-card";
import { F1NoteDialog } from "./f1-note-dialog";
import { F1RemindersBar } from "./f1-reminders-bar";
import { F1RemindersDialog } from "./f1-reminders-dialog";

type F1SelectionBoardProps = {
  stageId: string;
  round: RoundState;
  editable: boolean;
  selectedIds: Set<string>;
  maxSelections: number;
  onToggle: (participantId: string) => void;
  onLocalUpdate: (round: RoundState) => void;
  onOpenDisqualify: (participant: RoundParticipant) => void;
  onSaveNote?: (participantId: string, note: string | null) => Promise<void>;
  onSaveReminders?: (
    participantId: string,
    reminders: Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>
  ) => Promise<void>;
};

export function F1SelectionBoard({
  stageId,
  round,
  editable,
  selectedIds,
  maxSelections,
  onToggle,
  onLocalUpdate,
  onOpenDisqualify,
  onSaveNote,
  onSaveReminders,
}: F1SelectionBoardProps) {
  const { toast } = useToast();
  const [annotationBusy, setAnnotationBusy] = useState(false);
  const [remindersTarget, setRemindersTarget] = useState<RoundParticipant | null>(null);
  const [noteTarget, setNoteTarget] = useState<RoundParticipant | null>(null);

  const eligibleCount = round.participants.filter((participant) => participant.status === "ELIGIBLE").length;
  const limitReached = selectedIds.size >= maxSelections;

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
      const response = await stagedFlowService.updateRoundEntryReminders(
        stageId,
        participantId,
        reminders
      );
      if (response.data) {
        onLocalUpdate(response.data);
      }
    } catch (error) {
      handleAnnotationError();
      throw error;
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
    } catch (error) {
      handleAnnotationError();
      throw error;
    } finally {
      setAnnotationBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Recordatorios disponibles</p>
          <p className="mt-1 text-xs text-slate-500">
            Usa el botón + en cada tarjeta para marcar SUMA o RESTA en un ejemplar.
          </p>
        </div>
        <div className="mt-3">
          <F1RemindersBar reminders={round.availableReminders} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {round.participants.map((participant) => (
          <F1EntryCard
            key={participant.id}
            participant={participant}
            editable={editable}
            selected={selectedIds.has(participant.id)}
            blocked={
              participant.status !== "DISQUALIFIED" &&
              !selectedIds.has(participant.id) &&
              limitReached
            }
            onToggleSelect={onToggle}
            onOpenReminders={setRemindersTarget}
            onOpenNote={setNoteTarget}
            onOpenDisqualify={onOpenDisqualify}
          />
        ))}
      </div>

      {eligibleCount > 0 && (
        <p className="text-xs text-slate-500">
          {selectedIds.size} de {maxSelections} seleccionados · {eligibleCount} ejemplar
          {eligibleCount === 1 ? "" : "es"} en competencia
        </p>
      )}

      <F1RemindersDialog
        open={remindersTarget !== null}
        participant={remindersTarget}
        availableReminders={round.availableReminders}
        busy={annotationBusy}
        onOpenChange={(open) => {
          if (!open) setRemindersTarget(null);
        }}
        onApply={applyReminders}
      />

      <F1NoteDialog
        open={noteTarget !== null}
        participant={noteTarget}
        busy={annotationBusy}
        onOpenChange={(open) => {
          if (!open) setNoteTarget(null);
        }}
        onSave={saveNote}
      />
    </div>
  );
}
