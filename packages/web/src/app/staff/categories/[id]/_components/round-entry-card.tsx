"use client";

import { FileText, Plus, X } from "lucide-react";

import { ReminderIcon } from "@/components/reminder-icon";
import { cn } from "@/lib/utils";
import type { RoundParticipant } from "@/types/staged-flow";

export type RoundEntryCardBaseProps = {
  participant: RoundParticipant;
  editable: boolean;
  onOpenReminders: (participant: RoundParticipant) => void;
  onOpenNote: (participant: RoundParticipant) => void;
  onOpenDisqualify: (participant: RoundParticipant) => void;
};

export type F1RoundEntryCardProps = RoundEntryCardBaseProps & {
  variant: "f1";
  selected: boolean;
  blocked: boolean;
  onToggleSelect: (participantId: string) => void;
};

export type F2RoundEntryCardProps = RoundEntryCardBaseProps & {
  variant: "f2";
  nextPosition: number | null;
  onAssign: (participantId: string) => void;
};

export type RoundEntryCardProps = F1RoundEntryCardProps | F2RoundEntryCardProps;

export function RoundEntryCard(props: RoundEntryCardProps) {
  const {
    participant,
    editable,
    onOpenReminders,
    onOpenNote,
    onOpenDisqualify,
    variant,
  } = props;

  const hasNote = Boolean(participant.privateNote?.trim());
  const disqualified = participant.status === "DISQUALIFIED";
  const isF1 = variant === "f1";
  const selected = isF1 ? props.selected : false;
  const blocked = isF1 ? props.blocked : false;
  const nextPosition = isF1 ? null : props.nextPosition;
  const canAssign = !isF1 && editable && nextPosition !== null && !disqualified;
  const mainDisabled = disqualified || (isF1 ? !editable || blocked : !canAssign);

  const handleMainAction = () => {
    if (mainDisabled) return;
    if (isF1) {
      props.onToggleSelect(participant.id);
      return;
    }
    props.onAssign(participant.id);
  };

  const subtitle = disqualified
    ? "Descalificado"
    : isF1
      ? selected
        ? "Seleccionado"
        : "Clasificar"
      : nextPosition !== null
        ? `Puesto ${nextPosition}°`
        : "Asignar";

  return (
    <div
      className={cn(
        "relative flex min-h-[148px] flex-col rounded-xl border p-3 transition-all",
        disqualified
          ? "border-slate-200 bg-slate-50/80 opacity-70"
          : isF1 && selected
            ? "border-zapote bg-zapote shadow-sm"
            : "border-slate-200 bg-white shadow-sm",
        blocked && !selected && !disqualified ? "opacity-50" : ""
      )}
    >
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          disabled={!editable || disqualified}
          onClick={(event) => {
            event.stopPropagation();
            onOpenReminders(participant);
          }}
          className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Agregar recordatorios"
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          disabled={!editable || disqualified}
          onClick={(event) => {
            event.stopPropagation();
            onOpenNote(participant);
          }}
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
            hasNote ? "bg-violet-700 hover:bg-violet-800" : "bg-violet-600 hover:bg-violet-700"
          )}
          aria-label="Agregar nota privada"
        >
          <FileText className="size-3.5" />
        </button>
      </div>

      {!disqualified && editable && (
        <div className="absolute top-2 right-2 z-10">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDisqualify(participant);
            }}
            className="flex size-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
            title="Descalificar participante"
            aria-label="Descalificar participante"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={mainDisabled}
        onClick={handleMainAction}
        className={cn(
          "flex flex-1 flex-col items-center justify-center pt-6 pb-8",
          !mainDisabled ? "cursor-pointer" : "cursor-default"
        )}
      >
        <span
          className={cn(
            "text-5xl font-extrabold leading-none tracking-tight",
            disqualified ? "text-slate-400" : isF1 && selected ? "text-white" : "text-slate-400"
          )}
        >
          {participant.trackPosition}
        </span>
        <span
          className={cn(
            "mt-2 text-[11px] font-bold uppercase tracking-[0.2em]",
            disqualified ? "text-slate-500" : isF1 && selected ? "text-white" : "text-slate-400"
          )}
        >
          {subtitle}
        </span>
      </button>

      {participant.reminders.length > 0 && !disqualified && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {participant.reminders.map((reminder) => (
            <span
              key={`${participant.id}-${reminder.reminderId}`}
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-md border",
                reminder.effect === "SUMA"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
              title={`${reminder.name} (${reminder.effect})`}
            >
              <ReminderIcon icon={reminder.icon} className="size-3.5" />
            </span>
          ))}
        </div>
      )}

      {disqualified && participant.disqualificationReason && (
        <p className="mt-1 rounded-lg bg-red-50 px-2 py-1.5 text-center text-[10px] font-medium text-red-700">
          {participant.disqualificationReason.name}
        </p>
      )}
    </div>
  );
}
