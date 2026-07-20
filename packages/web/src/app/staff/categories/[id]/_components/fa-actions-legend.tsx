"use client";

import { RotateCcw, X } from "lucide-react";

export function FaActionsLegend() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-700 text-white">
            <RotateCcw className="size-3.5" />
          </span>
          <p className="text-sm leading-snug text-slate-600">
            <span className="font-semibold text-slate-800">Repetir pista:</span> solicitar al
            Director Técnico una nueva pasada del ejemplar en pista.
          </p>
        </div>

        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-red-600 text-white">
            <X className="size-3.5" strokeWidth={2.5} />
          </span>
          <p className="text-sm leading-snug text-slate-600">
            <span className="font-semibold text-slate-800">Descalificar:</span> marcar al ejemplar
            por una falta descalificante según el Reglamento.
          </p>
        </div>
      </div>
    </div>
  );
}
