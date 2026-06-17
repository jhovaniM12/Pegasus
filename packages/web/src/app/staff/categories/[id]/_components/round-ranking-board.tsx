"use client";

import { cn } from "@/lib/utils";
import type { RoundParticipant } from "@/types/staged-flow";

type RoundRankingBoardProps = {
  participants: RoundParticipant[];
  editable: boolean;
  desertedPositions: number[];
  onAssignParticipant: (participantId: string) => void;
  onUnassignParticipant: (participantId: string) => void;
  onToggleDesertedPosition: (position: number) => void;
};

const MAX_AWARD_POSITIONS = 5;

/**
 * Tablero F2 / desempate: puestos premiables editables por fila y ejemplares
 * sin puesto para asignación rápida.
 */
export function RoundRankingBoard({
  participants,
  editable,
  desertedPositions,
  onAssignParticipant,
  onUnassignParticipant,
  onToggleDesertedPosition,
}: RoundRankingBoardProps) {
  const deserted = new Set(desertedPositions);
  const participantByPosition = new Map(
    participants
      .filter((participant) => participant.position !== null)
      .map((participant) => [participant.position as number, participant])
  );
  const unranked = participants.filter((participant) => participant.position === null);
  const assignedPositions = new Set(participantByPosition.keys());
  const maxAssignedPosition = Math.max(0, ...assignedPositions);
  const totalPositions = Math.max(participants.length + deserted.size, maxAssignedPosition, ...desertedPositions);
  const maxDesertablePosition = Math.min(participants.length, MAX_AWARD_POSITIONS);
  const nextPosition =
    Array.from({ length: totalPositions }, (_, index) => index + 1).find(
      (position) => !assignedPositions.has(position) && !deserted.has(position)
    ) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Puestos de la tarjeta</p>
        <p className="mb-3 text-[11px] text-slate-500">
          En puestos 1 a {maxDesertablePosition} puedes asignar un ejemplar o declararlo desierto. Todos los
          ejemplares deben quedar con puesto; el desierto solo deja vacante una cinta premiable.
        </p>
        <div className="space-y-2">
          {Array.from({ length: totalPositions }, (_, index) => index + 1).map((position) => {
            const participant = participantByPosition.get(position);
            const isDeserted = deserted.has(position);
            const isPremiable = position <= maxDesertablePosition;

            return (
              <div
                key={position}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
                  isDeserted
                    ? "border-amber-300 bg-amber-50/60"
                    : participant
                      ? "border-blue-200 bg-white"
                      : "border-slate-200 bg-white"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold tabular-nums",
                      isDeserted
                        ? "bg-amber-200 text-amber-900"
                        : participant
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {position}°
                  </span>
                  <div className="min-w-0">
                    {isDeserted ? (
                      <p className="text-sm font-semibold text-amber-900">Puesto desierto</p>
                    ) : participant ? (
                      <>
                        <p className="truncate text-sm font-semibold text-slate-900">
                          #{participant.trackPosition} · {participant.riderName}
                        </p>
                        <p className="truncate font-mono text-xs text-slate-400">{participant.registrationNumber}</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">Sin asignar</p>
                    )}
                  </div>
                </div>

                {editable && (
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {participant && !isDeserted && (
                      <button
                        type="button"
                        onClick={() => onUnassignParticipant(participant.id)}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Quitar ejemplar
                      </button>
                    )}
                    {isPremiable && (
                      <button
                        type="button"
                        onClick={() => onToggleDesertedPosition(position)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                          isDeserted
                            ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
                            : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                        )}
                      >
                        {isDeserted ? "Quitar desierto" : "Declarar desierto"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {unranked.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ejemplares sin puesto
            {nextPosition !== null && editable && (
              <span className="ml-1 font-normal normal-case text-slate-400">
                · el siguiente recibe el puesto {nextPosition}°
              </span>
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unranked.map((participant) => (
              <button
                key={participant.id}
                type="button"
                disabled={!editable || nextPosition === null}
                onClick={() => onAssignParticipant(participant.id)}
                className={cn(
                  "flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-150",
                  editable && nextPosition !== null
                    ? "cursor-pointer border-slate-200 bg-white shadow-sm hover:border-slate-300 active:scale-[0.99]"
                    : "cursor-default border-slate-100 bg-slate-50 opacity-60"
                )}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-extrabold text-slate-400">
                  —
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-extrabold leading-none tracking-tight text-slate-900">
                    #{participant.trackPosition}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-600">{participant.riderName}</p>
                  <p className="truncate font-mono text-xs text-slate-400">{participant.registrationNumber}</p>
                </div>
                {editable && nextPosition !== null && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Puesto {nextPosition}°
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
