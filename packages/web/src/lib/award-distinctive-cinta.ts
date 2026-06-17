import type { CintaVariant } from "@/components/cinta";
import type { AwardDistinctive } from "@/types/award-distinctives";

const POSITION_VARIANTS: Record<number, CintaVariant> = {
  1: "primer",
  2: "segundo",
  3: "tercer",
  4: "cuarto",
  5: "quinto",
};

export function positionCintaVariant(position: number): CintaVariant {
  return POSITION_VARIANTS[position] ?? "sin_cinta";
}

export function findAwardDistinctiveForPosition(
  distinctives: AwardDistinctive[],
  position: number
): AwardDistinctive | null {
  return distinctives.find((row) => row.position === position && row.isActive) ?? null;
}

export function positionRibbonLabel(
  position: number,
  distinctive: AwardDistinctive | null,
  options?: { deserted?: boolean }
): string {
  const base = distinctive?.label?.trim() || `${position}°`;
  return options?.deserted ? `${base} · Desierta` : base;
}
