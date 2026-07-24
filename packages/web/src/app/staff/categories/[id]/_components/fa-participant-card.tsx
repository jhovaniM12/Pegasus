"use client";

import { RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FaParticipant } from "@/types/staged-flow";

export type FaParticipantCardProps = {
  participant: FaParticipant;
  selected: boolean;
  editable: boolean;
  onToggle: (id: string) => void;
  onRequestRepeatTrack: (id: string) => void;
  onOpenDisqualify: (id: string) => void;
};

export function FaParticipantCard({
  participant,
  selected,
  editable,
  onToggle,
  onRequestRepeatTrack,
  onOpenDisqualify,
}: FaParticipantCardProps) {
  const disqualified = participant.status === "DISQUALIFIED";
  const repeatRequest = participant.repeatTrackRequest;
  const repeatDisabled = !editable || disqualified || repeatRequest !== null;
  const repeatTitle =
    repeatRequest?.status === "EXECUTED"
      ? `Repetición ejecutada${repeatRequest.requestedBy ? `, solicitada por ${repeatRequest.requestedBy.name}` : ""}`
      : repeatRequest
        ? `Repetición solicitada${repeatRequest.requestedBy ? ` por ${repeatRequest.requestedBy.name}` : ""}`
        : "Solicitar repetir pista";

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
          <button
            type="button"
            disabled={repeatDisabled}
            onClick={() => onRequestRepeatTrack(participant.id)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border transition-colors",
              repeatRequest?.status === "EXECUTED"
                ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                : repeatRequest
                  ? "border-amber-100 bg-amber-50 text-amber-600"
                  : repeatDisabled
                    ? "border-slate-100 bg-slate-50 text-slate-300 cursor-default"
                    : "border-amber-100 bg-amber-50 hover:bg-amber-100 text-amber-700 cursor-pointer active:scale-95"
            )}
            title={repeatTitle}
          >
            <RotateCcw className="size-4" />
          </button>
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
              "mt-1.5 max-w-full truncate px-1 text-center text-xs font-semibold",
              disqualified
                ? "text-slate-400"
                : !editable && selected
                  ? "text-slate-500"
                  : selected
                    ? "text-amber-900/80"
                    : "text-slate-500"
            )}
            title={participant.horseName || undefined}
          >
            {participant.horseName || "Sin nombre"}
          </span>
          <span
            className={cn(
              "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
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

      {repeatRequest && !disqualified && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-semibold",
              repeatRequest.status === "EXECUTED"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            )}
          >
            {repeatRequest.status === "EXECUTED" ? "Repetición ejecutada" : "Repetición solicitada"}
            {repeatRequest.requestedBy && (
              <span className="mt-1 block font-medium opacity-80">Por: {repeatRequest.requestedBy.name}</span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
