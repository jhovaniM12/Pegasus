"use client";

import { cn } from "@/lib/utils";
import type { RoundParticipant } from "@/types/staged-flow";

type RoundRankingBoardProps = {
  participants: RoundParticipant[];
  editable: boolean;
  desertedPositions: number[];
  onToggleParticipant: (participantId: string) => void;
  onToggleDesertedPosition: (position: number) => void;
};

/**
 * Tablero de asignación de puestos F2 / desempate.
 *
 * Interacción "tap to rank": tocar un ejemplar le asigna el siguiente puesto
 * disponible; tocarlo de nuevo lo libera y renumera el resto. Pensado para uso
 * en celular durante la feria: acciones grandes, claras y de alto contraste.
 */
export function RoundRankingBoard({
  participants,
  editable,
  desertedPositions,
  onToggleParticipant,
  onToggleDesertedPosition,
}: RoundRankingBoardProps) {
  const deserted = new Set(desertedPositions);
  const totalPositions = participants.length;
  const assignedPositions = new Set(participants.map((participant) => participant.position).filter(Boolean) as number[]);
  const nextPosition =
    Array.from({ length: totalPositions }, (_, i) => i + 1).find(
      (position) => !assignedPositions.has(position) && !deserted.has(position)
    ) ?? totalPositions;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {participants.map((participant) => {
          const position = participant.position;
          const ranked = position !== null;

          return (
            <button
              key={participant.id}
              type="button"
              disabled={!editable}
              onClick={() => onToggleParticipant(participant.id)}
              className={cn(
                "relative flex items-center gap-4 overflow-hidden rounded-xl border p-4 text-left transition-all duration-150",
                ranked
                  ? "border-blue-500 bg-blue-50/50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-sm",
                editable ? "cursor-pointer active:scale-[0.99]" : "cursor-default"
              )}
            >
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-extrabold tabular-nums",
                  ranked ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                )}
              >
                {ranked ? position : "—"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-extrabold leading-none tracking-tight text-slate-900">
                  #{participant.trackPosition}
                </p>
                <p className="mt-1 truncate text-sm text-slate-600">{participant.riderName}</p>
                <p className="truncate font-mono text-xs text-slate-400">{participant.registrationNumber}</p>
              </div>
              {editable && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    ranked ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {ranked ? "Quitar" : `Puesto ${nextPosition}`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Puestos desiertos</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: totalPositions }, (_, i) => i + 1).map((position) => {
            const isAssigned = assignedPositions.has(position);
            const isDeserted = deserted.has(position);
            return (
              <button
                key={position}
                type="button"
                disabled={!editable || isAssigned}
                onClick={() => onToggleDesertedPosition(position)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-semibold tabular-nums transition-colors",
                  isAssigned
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : isDeserted
                      ? "border-amber-300 bg-amber-100 text-amber-800"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                )}
              >
                {position}° {isDeserted ? "Desierto" : isAssigned ? "Asignado" : "Disponible"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
