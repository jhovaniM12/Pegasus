"use client";

import { useMemo, useState } from "react";

import { ReminderIcon } from "@/components/reminder-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  RoundAvailableReminder,
  RoundParticipant,
  RoundParticipantReminder,
  RoundReminderEffect,
} from "@/types/staged-flow";

type DraftReminder = {
  reminderId: string;
  effect: RoundReminderEffect;
};

type F1RemindersDialogProps = {
  open: boolean;
  participant: RoundParticipant | null;
  availableReminders: RoundAvailableReminder[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (participantId: string, reminders: DraftReminder[]) => Promise<void>;
};

function toDraft(reminders: RoundParticipantReminder[]): DraftReminder[] {
  return reminders.map((row) => ({
    reminderId: row.reminderId,
    effect: row.effect,
  }));
}

function F1RemindersDialogBody({
  participant,
  availableReminders,
  busy,
  onOpenChange,
  onApply,
}: {
  participant: RoundParticipant;
  availableReminders: RoundAvailableReminder[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (participantId: string, reminders: DraftReminder[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftReminder[]>(() => toDraft(participant.reminders));

  const selectedCount = draft.length;

  const draftByReminderId = useMemo(
    () => new Map(draft.map((row) => [row.reminderId, row.effect])),
    [draft]
  );

  const setEffect = (reminderId: string, effect: RoundReminderEffect) => {
    setDraft((current) => {
      const existing = current.find((row) => row.reminderId === reminderId);
      if (existing?.effect === effect) {
        return current.filter((row) => row.reminderId !== reminderId);
      }
      const without = current.filter((row) => row.reminderId !== reminderId);
      return [...without, { reminderId, effect }];
    });
  };

  const handleApply = async () => {
    await onApply(participant.id, draft);
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Agregar recordatorios</DialogTitle>
        <DialogDescription>
          Selecciona los recordatorios y elige si son SUMA o RESTA para este ejemplar.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[50vh] space-y-2 overflow-y-auto py-1">
        {availableReminders.map((reminder) => {
          const effect = draftByReminderId.get(reminder.id);
          const isSelected = effect !== undefined;

          return (
            <div
              key={reminder.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                isSelected ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"
              )}
            >
              <div className="flex items-center gap-2">
                <ReminderIcon icon={reminder.icon} className="size-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-800">{reminder.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEffect(reminder.id, "RESTA")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                    effect === "RESTA"
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  − RESTA
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEffect(reminder.id, "SUMA")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                    effect === "SUMA"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  + SUMA
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={handleApply} disabled={busy}>
          {busy ? "Guardando..." : `Aplicar (${selectedCount})`}
        </Button>
      </DialogFooter>
    </>
  );
}

export function F1RemindersDialog({
  open,
  participant,
  availableReminders,
  busy,
  onOpenChange,
  onApply,
}: F1RemindersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {participant ? (
          <F1RemindersDialogBody
            key={participant.id}
            participant={participant}
            availableReminders={availableReminders}
            busy={busy}
            onOpenChange={onOpenChange}
            onApply={onApply}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
