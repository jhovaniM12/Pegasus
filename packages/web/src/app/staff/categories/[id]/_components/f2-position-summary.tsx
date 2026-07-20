"use client";

import { ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAwardDistinctives } from "@/hooks/use-award-distinctives";
import {
  findAwardDistinctiveForPosition,
  getPositionActiveStyle,
  hexLuminance,
  isLightHex,
} from "@/lib/award-distinctive-cinta";

export type PositionAssignmentSummaryItem = {
  position: number;
  trackPosition: number | null;
  deserted?: boolean;
};

type F2PositionSummaryProps = {
  items: PositionAssignmentSummaryItem[];
  assignedCount: number;
  totalPositions: number;
};

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Colores claros (p. ej. amarillo) necesitan más saturación para verse sobre el gris del resumen. */
function assignedCardSurface(hex: string): { backgroundColor: string; borderColor: string } {
  if (isLightHex(hex)) {
    return { backgroundColor: "#ffffff", borderColor: "#94a3b8" };
  }

  const luminance = hexLuminance(hex);
  const backgroundAlpha = luminance > 0.65 ? 0.42 : luminance > 0.45 ? 0.28 : 0.16;
  const borderAlpha = luminance > 0.65 ? 0.95 : luminance > 0.45 ? 0.75 : 0.55;

  return {
    backgroundColor: withAlpha(hex, backgroundAlpha),
    borderColor: withAlpha(hex, borderAlpha),
  };
}

export function F2PositionSummary({
  items,
  assignedCount,
  totalPositions,
}: F2PositionSummaryProps) {
  const { distinctives } = useAwardDistinctives();

  return (
    <div className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="size-4 text-slate-700" />
          <p className="text-sm font-semibold text-slate-900">Resumen de puestos</p>
        </div>
        <p className="text-xs font-medium tabular-nums text-slate-600">
          {assignedCount} / {totalPositions} asignados
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => {
          const assigned = item.trackPosition !== null;
          const deserted = Boolean(item.deserted) && !assigned;
          const distinctive = findAwardDistinctiveForPosition(distinctives, item.position);
          const activeStyle = getPositionActiveStyle(item.position, distinctives);
          const officialHex = distinctive?.colorHex ?? null;
          const lightOfficial = Boolean(officialHex && isLightHex(officialHex));

          return (
            <div
              key={item.position}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                assigned &&
                  !officialHex &&
                  (item.position === 1
                    ? "border-yellow-300 bg-yellow-50"
                    : item.position === 2
                      ? "border-red-300 bg-red-50"
                      : item.position === 3
                        ? "border-orange-300 bg-orange-50"
                        : item.position === 4
                          ? "border-emerald-300 bg-emerald-50"
                          : item.position === 5
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-300 bg-slate-50"),
                assigned && lightOfficial && "border-slate-300 bg-white",
                !assigned &&
                  (deserted
                    ? "border-slate-200 bg-slate-100"
                    : "border-dashed border-amber-300 bg-amber-50/70")
              )}
              style={assigned && officialHex ? assignedCardSurface(officialHex) : undefined}
            >
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  assigned ? "text-slate-700" : deserted ? "text-slate-500" : "text-amber-700"
                )}
              >
                {item.position}° puesto
              </span>
              {assigned ? (
                <span
                  className={cn(
                    "inline-flex min-w-8 items-center justify-center rounded-md px-1.5 py-0.5 text-sm font-bold tabular-nums",
                    activeStyle.className
                  )}
                  style={activeStyle.style}
                >
                  #{item.trackPosition}
                </span>
              ) : deserted ? (
                <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                  Desierto
                </span>
              ) : (
                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  Sin asignar
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
