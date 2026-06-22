"use client";

import { useState } from "react";
import { AlertTriangle, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TieBreakTestType } from "@/types/staged-flow";

const TEST_OPTIONS: { type: TieBreakTestType; label: string }[] = [
  { type: "DOUBLE_TABLE", label: "Doble tabla" },
  { type: "DIRECTION_CHANGE", label: "Cambios de dirección" },
  { type: "PARALLEL", label: "Paralelo" },
  { type: "CIRCLES", label: "Círculos" },
  { type: "STOP_AND_GO", label: "Pare y siga" },
  { type: "GAIT_CHANGE", label: "Cambio de andar" },
  { type: "MOUNT", label: "Montar ejemplares" },
];

export type TieBlockInfo = {
  /** Puesto de inicio del bloque empatado (el mejor puesto en disputa). */
  startPosition: number;
  /** Puesto de fin del bloque empatado (el peor puesto en disputa). */
  endPosition: number;
  /** Números de pista de los ejemplares involucrados en el bloque. */
  trackPositions: number[];
};

type TieBreakPanelProps = {
  busy: boolean;
  /** Información del bloque de empate actual que se va a resolver. */
  blockInfo: TieBlockInfo;
  onOpen: (testTypes: TieBreakTestType[]) => void;
};

function blockLabel(startPosition: number, endPosition: number): string {
  if (startPosition === endPosition) return `Empate por el ${startPosition}.° puesto`;
  return `Empate por puestos ${startPosition}°–${endPosition}°`;
}

export function TieBreakPanel({ busy, blockInfo, onOpen }: TieBreakPanelProps) {
  const [selected, setSelected] = useState<Set<TieBreakTestType>>(new Set());

  const toggle = (type: TieBreakTestType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-center gap-2 text-amber-900">
        <AlertTriangle className="size-5" />
        <h3 className="text-sm font-semibold">
          {blockLabel(blockInfo.startPosition, blockInfo.endPosition)}
        </h3>
      </div>
      <p className="mt-0.5 text-xs text-amber-700">
        {blockInfo.trackPositions.length} ejemplares empatados:{" "}
        <span className="font-semibold">
          {blockInfo.trackPositions.map((tp) => `#${tp}`).join(", ")}
        </span>
      </p>
      <p className="mt-2 text-xs text-amber-800">
        Selecciona las pruebas opcionales que se realizarán en pista. Los jueces volverán a emitir una
        tarjeta solo para los ejemplares empatados de este bloque.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TEST_OPTIONS.map((option) => {
          const active = selected.has(option.type);
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => toggle(option.type)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                active
                  ? "border-amber-500 bg-amber-100 text-amber-900"
                  : "border-amber-200 bg-white text-slate-600 hover:bg-amber-50"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <Button
        className="mt-4 w-full bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-600/50"
        disabled={busy || selected.size === 0}
        onClick={() => onOpen([...selected])}
      >
        <Scale className="size-4" />
        Abrir ronda de desempate
      </Button>
    </div>
  );
}
