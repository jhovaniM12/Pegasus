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
        "overflow-hidden rounded-xl border transition-all duration-150",
        disqualified
          ? "border-slate-200 bg-slate-50 opacity-60"
          : selected
            ? "border-amber-400 bg-amber-400 shadow-md shadow-amber-100"
            : "border-slate-200 bg-white shadow-sm"
      )}
    >
      <div className="flex items-stretch">
        {/* Repetir pista — visual estático, sin funcionalidad por ahora */}
        <div
          className={cn(
            "flex w-12 shrink-0 items-center justify-center",
            disqualified ? "bg-slate-300" : "bg-slate-700"
          )}
        >
          <RotateCcw className="size-4 text-white" />
        </div>

        {/* Centro — tap para seleccionar / deseleccionar */}
        <button
          type="button"
          disabled={!editable || disqualified}
          onClick={() => onToggle(participant.id)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-4 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300",
            editable && !disqualified ? "cursor-pointer active:scale-95" : "cursor-default"
          )}
        >
          <span
            className={cn(
              "text-3xl font-bold leading-none",
              disqualified ? "text-slate-400" : selected ? "text-white" : "text-slate-900"
            )}
          >
            {participant.trackPosition}
          </span>
          <span
            className={cn(
              "mt-1.5 text-xs font-semibold",
              disqualified ? "text-slate-400" : selected ? "text-amber-100" : "text-slate-400"
            )}
          >
            {disqualified ? "Descalificado" : selected ? "Seleccionado" : "Seleccionar"}
          </span>
        </button>

        {/* Descalificar */}
        <button
          type="button"
          disabled={!editable || disqualified}
          onClick={() => onExpandDisqualify(participant.id)}
          className={cn(
            "flex w-12 shrink-0 items-center justify-center transition-colors",
            disqualified
              ? "bg-red-200 cursor-default"
              : "bg-red-500 hover:bg-red-600 active:bg-red-700 cursor-pointer"
          )}
        >
          <X className="size-4 text-white" />
        </button>
      </div>

      {/* Panel de descalificación expandible */}
      {disqualifyExpanded && editable && !disqualified && (
        <div className="space-y-2 border-t border-slate-100 bg-white p-3">
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
              className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selectedReason}
              onClick={() => selectedReason && onDisqualify(participant.id, selectedReason.id)}
              className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Motivo visible si ya fue descalificado */}
      {disqualified && participant.disqualificationReason && (
        <div className="bg-white px-4 pb-3 pt-2">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {participant.disqualificationReason.name}
          </p>
        </div>
      )}
    </article>
  );
}
