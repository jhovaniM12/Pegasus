import type { CSSProperties } from "react";
import type { CintaVariant } from "@/components/cinta";
import type { AwardDistinctive } from "@/types/award-distinctives";

const POSITION_VARIANTS: Record<number, CintaVariant> = {
  1: "primer",
  2: "segundo",
  3: "tercer",
  4: "cuarto",
  5: "quinto",
};

export const POSITION_FALLBACK_CLASSES: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900",
  2: "bg-red-500 text-white",
  3: "bg-orange-400 text-white",
  4: "bg-emerald-500 text-white",
  5: "bg-blue-500 text-white",
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

export function hexLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isLightHex(hex: string): boolean {
  return hexLuminance(hex) > 0.85;
}

export function readableTextForHex(hex: string): string {
  return hexLuminance(hex) > 0.62 ? "text-slate-900" : "text-white";
}

export function getPositionActiveStyle(
  position: number,
  distinctives: AwardDistinctive[]
): { className: string; style?: CSSProperties } {
  const distinctive = findAwardDistinctiveForPosition(distinctives, position);
  if (distinctive?.colorHex) {
    const light = isLightHex(distinctive.colorHex);
    return {
      className: `${readableTextForHex(distinctive.colorHex)}${light ? " border border-slate-400" : ""}`,
      style: {
        backgroundColor: distinctive.colorHex,
        ...(light ? { boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.28)" } : {}),
      },
    };
  }
  return { className: POSITION_FALLBACK_CLASSES[position] ?? "bg-slate-400 text-white" };
}

export function positionRibbonLabel(
  position: number,
  distinctive: AwardDistinctive | null,
  options?: { deserted?: boolean }
): string {
  const base = distinctive?.label?.trim() || `${position}°`;
  return options?.deserted ? `${base} · Desierta` : base;
}
