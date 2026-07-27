/**
 * Derivación de puestos desiertos implícitos al cerrar F2.
 * El autosave NO debe usar esta función: solo persiste lo que envía el cliente.
 */

export function deriveImplicitDesertedPositions(input: {
  allowedPositions: number[];
  assignedPositions: number[];
  existingDesertedPositions: number[];
}): number[] {
  const assigned = new Set(input.assignedPositions);
  const alreadyDeserted = new Set(input.existingDesertedPositions);
  return input.allowedPositions.filter(
    (position) => !assigned.has(position) && !alreadyDeserted.has(position)
  );
}

/** Posiciones premiables de F2 (siempre 1..maxAwardPositions). */
export function f2AllowedPositions(
  minPosition: number,
  maxPosition: number
): number[] {
  if (maxPosition < minPosition) return [];
  return Array.from({ length: maxPosition - minPosition + 1 }, (_, index) => minPosition + index);
}
