"use client";

import { FileText, Plus, RotateCcw, X } from "lucide-react";

import { getPositionActiveStyle } from "@/lib/award-distinctive-cinta";
import { ReminderIcon } from "@/components/reminder-icon";
import { cn } from "@/lib/utils";
import type { AwardDistinctive } from "@/types/award-distinctives";
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
  assignedPosition: number | null;
  occupiedPositions: number[];
  allowedPositions: number[];
  awardDistinctives: AwardDistinctive[];
  onAssignToPosition: (participantId: string, position: number) => void;
  onUnassign: (participantId: string) => void;
};

export type RoundEntryCardProps = F1RoundEntryCardProps | F2RoundEntryCardProps;

const MAX_POSITIONS = 5;

function PrivateNoteBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-white text-[10px] font-bold leading-none text-violet-700",
        className
      )}
      aria-hidden
    >
      1
    </span>
  );
}

export function RoundEntryCard(props: RoundEntryCardProps) {
  const { participant, editable, onOpenReminders, onOpenNote, onOpenDisqualify, variant } = props;

  const hasNote = Boolean(participant.privateNote?.trim());
  const disqualified = participant.status === "DISQUALIFIED";

  if (variant === "f2") {
    const { assignedPosition, occupiedPositions, allowedPositions, awardDistinctives, onAssignToPosition, onUnassign } = props;
    const occupiedSet = new Set(occupiedPositions);

    return (
      <div
        className={cn(
          "relative flex min-h-[290px] flex-col rounded-xl border p-4 transition-all",
          disqualified
            ? "border-slate-200 bg-slate-50/80 opacity-70"
            : !editable
              ? "border-slate-200 bg-slate-50/60 opacity-85"
              : "border-slate-300 bg-slate-300/60 shadow-md"
        )}
      >
        {/* Top-left action buttons */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            disabled={!editable || disqualified}
            onClick={(e) => { e.stopPropagation(); onOpenReminders(participant); }}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Agregar recordatorios"
          >
            <Plus className="size-6" />
          </button>
          <button
            type="button"
            disabled={!editable || disqualified}
            onClick={(e) => { e.stopPropagation(); onOpenNote(participant); }}
            className={cn(
              "relative flex size-11 cursor-pointer items-center justify-center rounded-full text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
              hasNote ? "bg-violet-700 hover:bg-violet-800" : "bg-violet-600 hover:bg-violet-700"
            )}
            aria-label={hasNote ? "Ver nota privada" : "Agregar nota privada"}
          >
            <FileText className="size-5" />
            {hasNote && <PrivateNoteBadge className="size-5 text-[11px]" />}
          </button>
        </div>

        {/* Top-right disqualify */}
        {!disqualified && editable && (
          <div className="absolute top-3 right-3 z-10">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenDisqualify(participant); }}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
              aria-label="Descalificar participante"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        {/* Center: big track number */}
        <div className="flex flex-1 flex-col items-center justify-center pt-10 pb-2">
          <span
            className={cn(
              "text-7xl font-extrabold leading-none tracking-tight",
              disqualified ? "text-slate-400" : "text-slate-800"
            )}
          >
            {participant.trackPosition}
          </span>
          <span
            className={cn(
              "mt-2 max-w-full truncate px-1 text-center text-xs font-semibold",
              disqualified ? "text-slate-400" : "text-slate-500"
            )}
            title={participant.horseName || undefined}
          >
            {participant.horseName || "Sin nombre"}
          </span>
        </div>

        {/* Reminders row */}
        {participant.reminders.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
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

        {/* Reset button */}
        {editable && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              disabled={assignedPosition === null}
              onClick={() => onUnassign(participant.id)}
              title="Quitar puesto"
              aria-label="Quitar puesto asignado"
              className={cn(
                "flex size-10 items-center justify-center rounded-full border bg-white transition-colors",
                assignedPosition !== null
                  ? "cursor-pointer border-slate-300 text-slate-500 hover:bg-slate-50"
                  : "cursor-not-allowed border-slate-200 text-slate-300"
              )}
            >
              <RotateCcw className="size-5" />
            </button>
          </div>
        )}

        {/* Position strip */}
        {disqualified ? (
          <div className="rounded-lg bg-red-50 px-2 py-2 text-center text-xs font-medium text-red-700">
            <p>{participant.disqualificationReason?.name ?? "Descalificado"}</p>
            {participant.disqualifiedBy && (
              <p className="mt-0.5 font-normal text-red-600/90">Por: {participant.disqualifiedBy.name}</p>
            )}
          </div>
        ) : (
          <div className={cn("flex gap-1.5", !editable && "opacity-80")}>
            {(allowedPositions.length > 0 ? allowedPositions : Array.from({ length: MAX_POSITIONS }, (_, i) => i + 1)).map((pos) => {
              const isActive = assignedPosition === pos;
              const activeStyle = getPositionActiveStyle(pos, awardDistinctives);
              return (
                <button
                  key={pos}
                  type="button"
                  disabled={!editable}
                  onClick={() => {
                    if (isActive) {
                      onUnassign(participant.id);
                    } else {
                      onAssignToPosition(participant.id, pos);
                    }
                  }}
                  style={isActive ? activeStyle.style : undefined}
                  className={cn(
                    "flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border py-2 text-center text-[11px] font-bold leading-tight transition-colors disabled:cursor-default",
                    isActive
                      ? cn("shadow-sm", activeStyle.className)
                        : occupiedSet.has(pos)
                          ? "border-amber-300 bg-amber-50/80 text-amber-700 hover:bg-amber-100/80 disabled:hover:bg-amber-50/80"
                          : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:hover:bg-slate-100"
                  )}
                >
                  <span className="text-base font-extrabold leading-none">{pos}</span>
                  <span className="text-[11px]">Puesto</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── F1 variant (unchanged) ───────────────────────────────────────────────
  const isF1 = true;
  const selected = props.selected;
  const blocked = props.blocked;
  const mainDisabled = disqualified || !editable || blocked;

  const subtitle = disqualified
    ? "Descalificado"
    : selected
      ? "Seleccionado"
      : "Clasificar";

  return (
    <div
      className={cn(
        "relative flex min-h-[188px] flex-col rounded-xl border p-4 transition-all",
        disqualified
          ? "border-slate-200 bg-slate-50/80 opacity-70"
          : selected
            ? "border-zapote bg-zapote shadow-sm"
            : "border-slate-200 bg-white shadow-sm",
        blocked && !selected && !disqualified ? "opacity-50" : ""
      )}
    >
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          disabled={!editable || disqualified}
          onClick={(event) => { event.stopPropagation(); onOpenReminders(participant); }}
          className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Agregar recordatorios"
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          disabled={!editable || disqualified}
          onClick={(event) => { event.stopPropagation(); onOpenNote(participant); }}
          className={cn(
            "relative flex size-9 items-center justify-center rounded-full text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
            hasNote ? "bg-violet-700 hover:bg-violet-800" : "bg-violet-600 hover:bg-violet-700"
          )}
          aria-label={hasNote ? "Ver nota privada" : "Agregar nota privada"}
        >
          <FileText className="size-4.5" />
          {hasNote && <PrivateNoteBadge />}
        </button>
      </div>

      {!disqualified && editable && (
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onOpenDisqualify(participant); }}
            className="flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
            title="Descalificar participante"
            aria-label="Descalificar participante"
          >
            <X className="size-4.5" />
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={mainDisabled}
        onClick={() => { if (!mainDisabled) props.onToggleSelect(participant.id); }}
        className={cn(
          "flex flex-1 flex-col items-center justify-center pt-8 pb-10",
          !mainDisabled ? "cursor-pointer" : "cursor-default"
        )}
      >
        <span
          className={cn(
            "text-6xl font-extrabold leading-none tracking-tight",
            disqualified ? "text-slate-400" : isF1 && selected ? "text-white" : "text-slate-400"
          )}
        >
          {participant.trackPosition}
        </span>
        <span
          className={cn(
            "mt-2 max-w-full truncate px-1 text-center text-xs font-semibold",
            disqualified
              ? "text-slate-400"
              : selected
                ? "text-white/85"
                : "text-slate-500"
          )}
          title={participant.horseName || undefined}
        >
          {participant.horseName || "Sin nombre"}
        </span>
        <span
          className={cn(
            "mt-1.5 text-xs font-bold uppercase tracking-[0.2em]",
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
          {participant.disqualifiedBy && (
            <span className="mt-0.5 block font-normal text-red-600/90">
              Por: {participant.disqualifiedBy.name}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
