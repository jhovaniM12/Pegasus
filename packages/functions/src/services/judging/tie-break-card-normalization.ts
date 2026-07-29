export type TieBreakCardAssignment = {
  participantId: string;
  position: number | null;
};

/**
 * Elimina al descalificado y comprime densamente el orden relativo de los
 * sobrevivientes. Los no asignados permanecen sin puesto.
 */
export function normalizeTieBreakCardAssignments(
  assignments: TieBreakCardAssignment[],
  minimumPosition: number
): Map<string, number> {
  return new Map(
    assignments
      .filter(
        (assignment): assignment is TieBreakCardAssignment & { position: number } =>
          assignment.position != null
      )
      .sort(
        (a, b) =>
          a.position - b.position || a.participantId.localeCompare(b.participantId)
      )
      .map((assignment, index) => [
        assignment.participantId,
        minimumPosition + index
      ])
  );
}
