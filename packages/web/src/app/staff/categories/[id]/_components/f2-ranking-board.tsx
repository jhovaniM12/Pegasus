"use client";

import { useState } from "react";
import { Clock, History } from "lucide-react";

import { useAwardDistinctives } from "@/hooks/use-award-distinctives";
import { useToast } from "@/components/ui/toast";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { RoundParticipant, RoundState } from "@/types/staged-flow";
import { F1NoteDialog } from "./f1-note-dialog";
import { F1ReminderHistory } from "./f1-reminder-history";
import { F1RemindersBar } from "./f1-reminders-bar";
import { F1RemindersDialog } from "./f1-reminders-dialog";
import { RoundRankingBoard } from "./round-ranking-board";

type F2RankingBoardProps = {
  stageId: string;
  round: RoundState;
  editable: boolean;
  desertedPositions: number[];
  onAssignParticipant: (participantId: string) => void;
  onUnassignParticipant: (participantId: string) => void;
  onToggleDesertedPosition: (position: number) => void;
  onLocalUpdate: (round: RoundState) => void;
  onOpenDisqualify: (participant: RoundParticipant) => void;
};

export function F2RankingBoard({
  stageId,
  round,
  editable,
  desertedPositions,
  onAssignParticipant,
  onUnassignParticipant,
  onToggleDesertedPosition,
  onLocalUpdate,
  onOpenDisqualify,
}: F2RankingBoardProps) {
  const { toast } = useToast();
  const { distinctives: awardDistinctives } = useAwardDistinctives();
  const [historyOpen, setHistoryOpen] = useState(true);
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
      const response = await stagedFlowService.updateRoundEntryReminders(
        stageId,
        participantId,
        reminders
      );
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

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Recordatorios disponibles</p>
            <p className="mt-1 text-xs text-slate-500">
              Usa el botón + en cada tarjeta para marcar SUMA o RESTA en un ejemplar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {historyOpen ? <Clock className="size-4" /> : <History className="size-4" />}
            {historyOpen ? "Ocultar historial" : "Mostrar historial"}
          </button>
        </div>
        <div className="mt-3">
          <F1RemindersBar reminders={round.availableReminders} />
        </div>
      </div>

      {historyOpen && (
        <F1ReminderHistory items={round.reminderHistory} onClose={() => setHistoryOpen(false)} />
      )}

      <RoundRankingBoard
        participants={round.participants}
        editable={editable}
        desertedPositions={desertedPositions}
        awardDistinctives={awardDistinctives}
        onAssignParticipant={onAssignParticipant}
        onUnassignParticipant={onUnassignParticipant}
        onToggleDesertedPosition={onToggleDesertedPosition}
        onOpenDisqualify={onOpenDisqualify}
        onOpenReminders={setRemindersTarget}
        onOpenNote={setNoteTarget}
      />

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
