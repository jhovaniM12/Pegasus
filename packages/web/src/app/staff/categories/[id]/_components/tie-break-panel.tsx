"use client";

import { useState } from "react";
import { AlertTriangle, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TieBreakTestType } from "@/types/staged-flow";
import type { TieBreakReason } from "@pegasus/core/judging/tie-blocks";

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
  reason: TieBreakReason;
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
  judges: Array<{ judgeUserId: string; judgeName: string }>;
  onOpen: (input: {
    testTypes: TieBreakTestType[];
    votes: Array<{ judgeUserId: string; approved: boolean }>;
    publicDrawConfirmed: boolean;
    drawNotes: string;
  }) => void;
};

function assertNever(value: never): never {
  throw new Error(`Causa de desempate no soportada: ${String(value)}`);
}

function blockLabel(blockInfo: TieBlockInfo): string {
  switch (blockInfo.reason) {
    case "SUM_EQUALITY":
      if (blockInfo.startPosition === blockInfo.endPosition) {
        return `Empate por el ${blockInfo.startPosition}.° puesto`;
      }
      return `Empate por puestos ${blockInfo.startPosition}°–${blockInfo.endPosition}°`;
    case "FIFTH_PLACE_EXCEPTION_5E":
      return "Desempate especial para definir el quinto puesto";
    default:
      return assertNever(blockInfo.reason);
  }
}

export function TieBreakPanel({ busy, blockInfo, judges, onOpen }: TieBreakPanelProps) {
  const [selected, setSelected] = useState<TieBreakTestType | null>(null);
  const [votes, setVotes] = useState<Record<string, boolean | null>>({});
  const [publicDrawConfirmed, setPublicDrawConfirmed] = useState(false);
  const [drawNotes, setDrawNotes] = useState("");
  const allVotesRecorded = judges.every((judge) => votes[judge.judgeUserId] != null);
  const drawReady = selected === "MOUNT" || publicDrawConfirmed;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-center gap-2 text-amber-900">
        <AlertTriangle className="size-5" />
        <h3 className="text-sm font-semibold">
          {blockLabel(blockInfo)}
        </h3>
      </div>
      <p className="mt-0.5 text-xs text-amber-700">
        {blockInfo.trackPositions.length} ejemplares convocados:{" "}
        <span className="font-semibold">
          {blockInfo.trackPositions.map((tp) => `#${tp}`).join(", ")}
        </span>
      </p>
      <p className="mt-2 text-xs text-amber-800">
        Selecciona la prueba opcional que se realizará en pista. Los jueces volverán a emitir una
        tarjeta solo para los ejemplares de este bloque.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TEST_OPTIONS.map((option) => {
          const active = selected === option.type;
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => setSelected((prev) => (prev === option.type ? null : option.type))}
              aria-pressed={active}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                active
                  ? "border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-300"
                  : "border-amber-200 bg-white text-slate-600 hover:bg-amber-50"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-800">Votos individuales</p>
        {judges.map((judge) => (
          <div key={judge.judgeUserId} className="flex items-center justify-between gap-3 text-xs">
            <span>{judge.judgeName}</span>
            <div className="flex gap-1">
              {[true, false].map((approved) => (
                <button
                  key={String(approved)}
                  type="button"
                  onClick={() =>
                    setVotes((current) => ({ ...current, [judge.judgeUserId]: approved }))
                  }
                  className={cn(
                    "rounded border px-2 py-1",
                    votes[judge.judgeUserId] === approved
                      ? "border-amber-500 bg-amber-100 text-amber-900"
                      : "border-slate-200 text-slate-600"
                  )}
                >
                  {approved ? "A favor" : "En contra"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-amber-900">
        <input
          type="checkbox"
          checked={publicDrawConfirmed}
          disabled={selected === "MOUNT"}
          onChange={(event) => setPublicDrawConfirmed(event.target.checked)}
        />
        Certifico que la prueba fue seleccionada mediante sorteo público
      </label>
      <textarea
        className="mt-3 min-h-20 w-full rounded-lg border border-amber-200 bg-white p-2 text-xs"
        value={drawNotes}
        onChange={(event) => setDrawNotes(event.target.value)}
        placeholder="Acta, testigos y observaciones del sorteo o de la decisión de Montar"
        maxLength={1000}
      />

      <Button
        className="mt-4 w-full bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-600/50"
        disabled={busy || !selected || !allVotesRecorded || !drawReady || !drawNotes.trim()}
        onClick={() => {
          if (!selected) return;
          onOpen({
            testTypes: [selected],
            votes: judges.map((judge) => ({
              judgeUserId: judge.judgeUserId,
              approved: votes[judge.judgeUserId] === true
            })),
            publicDrawConfirmed,
            drawNotes: drawNotes.trim()
          });
        }}
      >
        <Scale className="size-4" />
        Abrir ronda de desempate
      </Button>
    </div>
  );
}
