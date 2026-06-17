import { MAX_AWARD_POSITIONS } from "@pegasus/core";

export type AwardDistinctiveInput = {
  position: number;
  label: string;
  colorName: string;
  colorHex: string | null;
  isActive: boolean;
};

export type AwardDistinctiveView = {
  position: number;
  label: string;
  colorName: string;
  colorHex: string | null;
};

export function resolveAwardDistinctiveForPosition(
  distinctivesByPosition: Map<number, AwardDistinctiveInput>,
  finalPosition: number | null
): AwardDistinctiveView | null {
  if (!finalPosition || finalPosition < 1 || finalPosition > MAX_AWARD_POSITIONS) {
    return null;
  }

  const distinctive = distinctivesByPosition.get(finalPosition);
  if (!distinctive || !distinctive.isActive) {
    return null;
  }

  return {
    position: distinctive.position,
    label: distinctive.label,
    colorName: distinctive.colorName,
    colorHex: distinctive.colorHex
  };
}
