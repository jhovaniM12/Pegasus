"use client";

import type { KeyboardEvent, MouseEvent } from "react";
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
  const canSelect = editable && !disqualified;
  const canRepeat = editable && !disqualified && repeatRequest === null;
  const canDisqualify = editable && !disqualified;
  const repeatTitle =
    repeatRequest?.status === "EXECUTED"
      ? `Repetición ejecutada${repeatRequest.requestedBy ? `, solicitada por ${repeatRequest.requestedBy.name}` : ""}`
      : repeatRequest
        ? `Repetición solicitada${repeatRequest.requestedBy ? ` por ${repeatRequest.requestedBy.name}` : ""}`
        : "Solicitar repetir pista";

  const handleSelect = () => {
    if (!canSelect) return;
    onToggle(participant.id);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!canSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(participant.id);
    }
  };

  const handleRepeatClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Evita que el clic “caiga” en la selección de la tarjeta (sobre todo con botones inactivos).
    event.stopPropagation();
    if (!canRepeat) return;
    onRequestRepeatTrack(participant.id);
  };

  const handleDisqualifyClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!canDisqualify) return;
    onOpenDisqualify(participant.id);
  };

  return (
    <article
      role={canSelect ? "button" : undefined}
      tabIndex={canSelect ? 0 : undefined}
      onClick={handleSelect}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-4 transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
        disqualified
          ? "border-slate-200 bg-slate-50/60 opacity-60"
          : !editable && selected
            ? "border-slate-300 bg-slate-100"
            : selected
              ? "border-amber-500 bg-amber-50/40 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300 shadow-sm",
        canSelect ? "cursor-pointer" : "cursor-default"
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex shrink-0 items-center justify-center">
          <button
            type="button"
            aria-disabled={!canRepeat}
            onClick={handleRepeatClick}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border transition-colors",
              repeatRequest?.status === "EXECUTED"
                ? "border-emerald-100 bg-emerald-50 text-emerald-600 cursor-default"
                : repeatRequest
                  ? "border-amber-100 bg-amber-50 text-amber-600 cursor-default"
                  : canRepeat
                    ? "border-amber-100 bg-amber-50 hover:bg-amber-100 text-amber-700 cursor-pointer active:scale-95"
                    : "border-slate-100 bg-slate-50 text-slate-300 cursor-default"
            )}
            title={repeatTitle}
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center py-2">
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
        </div>

        <div className="flex shrink-0 items-center justify-center">
          <button
            type="button"
            aria-disabled={!canDisqualify}
            onClick={handleDisqualifyClick}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border transition-all duration-150",
              canDisqualify
                ? "border-red-100 bg-red-50 hover:bg-red-100 text-red-600 active:scale-95 cursor-pointer"
                : "border-slate-100 bg-slate-50 text-slate-300 cursor-default"
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

      {!disqualified && participant.provisionalDisqualification && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Hiperflexión reportada: {participant.provisionalDisqualification.reportCount}/
            {participant.provisionalDisqualification.requiredReports} votos. El ejemplar continúa
            provisionalmente elegible.
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
