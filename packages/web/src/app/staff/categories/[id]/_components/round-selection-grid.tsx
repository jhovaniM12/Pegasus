"use client";

import { cn } from "@/lib/utils";
import type { RoundParticipant } from "@/types/staged-flow";

type RoundSelectionGridProps = {
  participants: RoundParticipant[];
  editable: boolean;
  selectedIds: Set<string>;
  maxSelections: number;
  onToggle: (participantId: string) => void;
};

/**
 * Rejilla de selección F1 (cabeza de lote): el juez marca hasta `maxSelections`
 * ejemplares. Reutiliza el lenguaje visual de la rejilla FA.
 */
export function RoundSelectionGrid({
  participants,
  editable,
  selectedIds,
  maxSelections,
  onToggle,
}: RoundSelectionGridProps) {
  const limitReached = selectedIds.size >= maxSelections;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {participants.map((participant) => {
        const selected = selectedIds.has(participant.id);
        const blocked = !selected && limitReached;

        return (
          <button
            key={participant.id}
            type="button"
            disabled={!editable || blocked}
            onClick={() => onToggle(participant.id)}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border p-4 transition-all duration-150",
              selected
                ? "border-amber-500 bg-amber-50/40 shadow-sm"
                : blocked
                  ? "border-slate-100 bg-slate-50 opacity-50"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-sm",
              editable && !blocked ? "cursor-pointer active:scale-95" : "cursor-default"
            )}
          >
            <span
              className={cn(
                "text-3xl font-extrabold leading-none tracking-tight",
                selected ? "text-amber-950" : "text-slate-900"
              )}
            >
              {participant.trackPosition}
            </span>
            <span className="mt-1 truncate text-xs text-slate-500">{participant.riderName}</span>
            <span
              className={cn(
                "mt-2.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                selected ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
              )}
            >
              {selected ? "Cabeza de lote" : "Seleccionar"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
