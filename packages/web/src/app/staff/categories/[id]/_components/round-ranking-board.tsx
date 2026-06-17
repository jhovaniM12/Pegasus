"use client";

import { cn } from "@/lib/utils";
import {
  findAwardDistinctiveForPosition,
  positionCintaVariant,
  positionRibbonLabel,
} from "@/lib/award-distinctive-cinta";
import { Cinta } from "@/components/cinta";
import { X } from "lucide-react";
import type { AwardDistinctive } from "@/types/award-distinctives";
import type { RoundParticipant } from "@/types/staged-flow";
import { RoundEntryCard } from "./round-entry-card";

type RoundRankingBoardProps = {
  participants: RoundParticipant[];
  editable: boolean;
  desertedPositions: number[];
  awardDistinctives?: AwardDistinctive[];
  onAssignParticipant: (participantId: string) => void;
  onUnassignParticipant: (participantId: string) => void;
  onToggleDesertedPosition: (position: number) => void;
  onOpenDisqualify: (participant: RoundParticipant) => void;
  onOpenReminders: (participant: RoundParticipant) => void;
  onOpenNote: (participant: RoundParticipant) => void;
};

const MAX_AWARD_POSITIONS = 5;

function PositionIndicator({
  position,
  awardDistinctives,
  deserted,
}: {
  position: number;
  awardDistinctives: AwardDistinctive[];
  deserted?: boolean;
}) {
  if (position > MAX_AWARD_POSITIONS) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-extrabold tabular-nums text-slate-500">
        {position}°
      </span>
    );
  }

  const distinctive = findAwardDistinctiveForPosition(awardDistinctives, position);

  return (
    <Cinta
      text={positionRibbonLabel(position, distinctive, { deserted })}
      variant={distinctive?.colorHex ? "sin_cinta" : positionCintaVariant(position)}
      colorHex={distinctive?.colorHex}
      className="min-w-[5.5rem] px-3 py-1 text-[11px] font-bold"
    />
  );
}

export function RoundRankingBoard({
  participants,
  editable,
  desertedPositions,
  awardDistinctives = [],
  onAssignParticipant,
  onUnassignParticipant,
  onToggleDesertedPosition,
  onOpenDisqualify,
  onOpenReminders,
  onOpenNote,
}: RoundRankingBoardProps) {
  const eligibleParticipants = participants.filter((participant) => participant.status === "ELIGIBLE");
  const disqualifiedParticipants = participants.filter((participant) => participant.status === "DISQUALIFIED");
  const deserted = new Set(desertedPositions);
  const participantByPosition = new Map(
    eligibleParticipants
      .filter((participant) => participant.position !== null)
      .map((participant) => [participant.position as number, participant])
  );
  const unranked = eligibleParticipants.filter((participant) => participant.position === null);
  const assignedPositions = new Set(participantByPosition.keys());
  const maxAssignedPosition = Math.max(0, ...assignedPositions);
  const totalPositions = Math.max(
    eligibleParticipants.length + deserted.size,
    maxAssignedPosition,
    ...desertedPositions
  );
  const maxDesertablePosition = Math.min(eligibleParticipants.length, MAX_AWARD_POSITIONS);
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
          ejemplares elegibles deben quedar con puesto.
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
                  <PositionIndicator
                    position={position}
                    awardDistinctives={awardDistinctives}
                    deserted={isDeserted}
                  />
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
                      <>
                        <button
                          type="button"
                          onClick={() => onUnassignParticipant(participant.id)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Quitar ejemplar
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDisqualify(participant)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <X className="size-3" />
                          Descalificar
                        </button>
                      </>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {unranked.map((participant) => (
              <RoundEntryCard
                key={participant.id}
                variant="f2"
                participant={participant}
                editable={editable}
                nextPosition={nextPosition}
                onAssign={onAssignParticipant}
                onOpenReminders={onOpenReminders}
                onOpenNote={onOpenNote}
                onOpenDisqualify={onOpenDisqualify}
              />
            ))}
          </div>
        </div>
      )}

      {disqualifiedParticipants.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Descalificados</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {disqualifiedParticipants.map((participant) => (
              <div
                key={participant.id}
                className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-slate-800">
                  #{participant.trackPosition} · {participant.riderName}
                </p>
                {participant.disqualificationReason && (
                  <p className="mt-1 text-xs text-red-700">{participant.disqualificationReason.name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
