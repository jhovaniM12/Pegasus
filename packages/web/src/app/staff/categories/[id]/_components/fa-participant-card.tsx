"use client";

import { RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DisqualificationReason, FaParticipant } from "@/types/staged-flow";

export type FaParticipantCardProps = {
  participant: FaParticipant;
  selected: boolean;
  editable: boolean;
  disqualifyExpanded: boolean;
  selectedReasonId: string;
  reasons: DisqualificationReason[];
  onToggle: (id: string) => void;
  onExpandDisqualify: (id: string) => void;
  onReasonChange: (id: string, reasonId: string) => void;
  onDisqualify: (id: string, reasonId: string) => void;
};

export function FaParticipantCard({
  participant,
  selected,
  editable,
  disqualifyExpanded,
  selectedReasonId,
  reasons,
  onToggle,
  onExpandDisqualify,
  onReasonChange,
  onDisqualify,
}: FaParticipantCardProps) {
  const disqualified = participant.status === "DISQUALIFIED";
  const selectedReason = reasons.find((r) => r.id === selectedReasonId) ?? null;

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
        {/* Repetir pista — botón discreto redondo en el extremo izquierdo */}
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

        {/* Centro — botón para seleccionar / deseleccionar */}
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

        {/* Descalificar — botón discreto redondo en el extremo derecho */}
        <div className="flex shrink-0 items-center justify-center">
          <button
            type="button"
            disabled={!editable || disqualified}
            onClick={() => onExpandDisqualify(participant.id)}
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

      {/* Panel de descalificación expandible */}
      {disqualifyExpanded && editable && !disqualified && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-600">Motivo de descalificación</p>
          <select
            value={selectedReasonId}
            onChange={(e) => onReasonChange(participant.id, e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-shadow focus:border-red-300 focus:ring-2 focus:ring-red-100"
          >
            <option value="">Seleccionar motivo</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} – {r.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onExpandDisqualify(participant.id)}
              className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selectedReason}
              onClick={() => selectedReason && onDisqualify(participant.id, selectedReason.id)}
              className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Motivo visible si ya fue descalificado */}
      {disqualified && participant.disqualificationReason && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            Motivo: {participant.disqualificationReason.name}
          </p>
        </div>
      )}
    </article>
  );
}
