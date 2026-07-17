"use client";

import { RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FaParticipant } from "@/types/staged-flow";

export type FaParticipantCardProps = {
  participant: FaParticipant;
  selected: boolean;
  editable: boolean;
  onToggle: (id: string) => void;
  onOpenDisqualify: (id: string) => void;
};

export function FaParticipantCard({
  participant,
  selected,
  editable,
  onToggle,
  onOpenDisqualify,
}: FaParticipantCardProps) {
  const disqualified = participant.status === "DISQUALIFIED";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-150 p-4",
        disqualified
          ? "border-slate-200 bg-slate-50/60 opacity-60"
          : !editable && selected
            ? "border-slate-300 bg-slate-100"
            : selected
              ? "border-amber-500 bg-amber-50/40 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex shrink-0 items-center justify-center">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-full border text-slate-500 transition-colors",
              disqualified || (!editable && selected)
                ? "border-slate-100 bg-slate-50 text-slate-300"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer"
            )}
            title="Repetir pista (visual)"
          >
            <RotateCcw className="size-4" />
          </div>
        </div>

        <button
          type="button"
          disabled={!editable || disqualified}
          onClick={() => onToggle(participant.id)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-2 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500",
            editable && !disqualified ? "cursor-pointer active:scale-95" : "cursor-default"
          )}
        >
          <span
            className={cn(
              "text-3xl font-extrabold tracking-tight leading-none",
              disqualified
                ? "text-slate-400"
                : !editable && selected
                  ? "text-slate-500"
                  : selected
                    ? "text-amber-950"
                    : "text-slate-900"
            )}
          >
            {participant.trackPosition}
          </span>
          <span
            className={cn(
              "mt-2.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
              disqualified
                ? "bg-slate-100 text-slate-500"
                : !editable && selected
                  ? "bg-slate-200 text-slate-600"
                  : selected
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
            )}
          >
            {disqualified ? "Descalificado" : selected ? "Seleccionado" : "Seleccionar"}
          </span>
        </button>

        <div className="flex shrink-0 items-center justify-center">
          <button
            type="button"
            disabled={!editable || disqualified}
            onClick={() => onOpenDisqualify(participant.id)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border transition-all duration-150",
              !editable || disqualified
                ? "border-slate-100 bg-slate-50 text-slate-300 cursor-default"
                : "border-red-100 bg-red-50 hover:bg-red-100 text-red-600 active:scale-95 cursor-pointer"
            )}
            title="Descalificar participante"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {disqualified && (participant.disqualificationReason || participant.disqualifiedBy) && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {participant.disqualificationReason && (
              <p>Motivo: {participant.disqualificationReason.name}</p>
            )}
            {participant.disqualifiedBy && (
              <p className={participant.disqualificationReason ? "mt-1 font-semibold text-red-800" : "font-semibold text-red-800"}>
                Descalificado por: {participant.disqualifiedBy.name}
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
