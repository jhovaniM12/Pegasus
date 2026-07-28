"use client";

import { useEffect, useState } from "react";
import type { TieBreakReason } from "@pegasus/core/judging/tie-blocks";
import { PegasoLogo } from "@/components/brand/pegaso-logo";
import { cn } from "@/lib/utils";

export type TieBreakAnnouncementEntry = {
  trackPosition: number;
  horseName: string | null;
};

type TieBreakAnnouncementProps = {
  reason: TieBreakReason;
  startPosition: number;
  endPosition: number;
  entries: TieBreakAnnouncementEntry[];
  /** DT aún no abrió la tarjeta de desempate. */
  phase: "awaiting_director" | "tie_break_open";
  className?: string;
};

function assertNever(value: never): never {
  throw new Error(`Causa de desempate no soportada: ${String(value)}`);
}

function reasonTitle(reason: TieBreakReason, startPosition: number, endPosition: number): string {
  switch (reason) {
    case "SUM_EQUALITY":
      if (startPosition === endPosition) {
        return `Empate por el ${startPosition}.° puesto`;
      }
      return `Empate por puestos ${startPosition}°–${endPosition}°`;
    case "FIFTH_PLACE_EXCEPTION_5E":
      return "Desempate especial para el quinto puesto";
    default:
      return assertNever(reason);
  }
}

export function TieBreakAnnouncement({
  reason,
  startPosition,
  endPosition,
  entries,
  phase,
  className,
}: TieBreakAnnouncementProps) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setDots((value) => (value + 1) % 4), 500);
    return () => window.clearInterval(id);
  }, []);

  const waitingLabel =
    phase === "tie_break_open"
      ? "Desempate habilitado"
      : "Esperando acción del Director Técnico";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-200 shadow-sm",
        className
      )}
    >
      <style>{`
        @keyframes pegaso-tie-pop {
          0% { opacity: 0; transform: scale(0.92) translateY(8px); }
          60% { opacity: 1; transform: scale(1.02) translateY(-1px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pegaso-tie-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pegaso-tie-title {
          animation: pegaso-tie-pop 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pegaso-tie-fade {
          animation: pegaso-tie-fade-up 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>

      {/* Capa de fondo: Imagen desenfocada con overlay oscuro */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: "url('https://images.unsplash.com/photo-1598974357801-cbca100e65d3?q=80&w=2000&auto=format&fit=crop')",
          filter: "blur(6px)",
          transform: "scale(1.05)" // Evita bordes blancos por el blur
        }}
      />
      <div className="absolute inset-0 bg-slate-950/55" />

        <div className="relative z-10 bg-gradient-to-b from-slate-950/70 via-slate-950/35 to-slate-950/75 px-5 py-8 sm:px-8 sm:py-11">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-xl bg-white p-2 shadow-lg">
              <PegasoLogo size="lg" className="rounded-md" priority />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
              Juzgamiento en pista
            </p>
          </div>

          <div className="mt-7 text-center">
            <h2 className="pegaso-tie-title text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl [text-shadow:0_2px_10px_rgba(0,0,0,0.5)]">
              Empate técnico
            </h2>
            <p className="mt-3 inline-block rounded-full border border-amber-400/40 bg-amber-950/60 px-4 py-1 text-sm font-semibold text-amber-300 shadow-sm backdrop-blur-sm">
              {reasonTitle(reason, startPosition, endPosition)}
            </p>
          </div>

          <div className="pegaso-tie-fade mt-10" style={{ animationDelay: "0.15s" }}>
            <p className="text-center text-[12px] font-semibold uppercase tracking-[0.15em] text-slate-200 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
              Ejemplares convocados al desempate
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-4">
              {entries.map((entry) => (
                <div
                  key={`${entry.trackPosition}-${entry.horseName ?? "sin-nombre"}`}
                  className="flex aspect-square w-28 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#0f233e] p-3 text-white shadow-[0_8px_30px_rgb(0,0,0,0.4)] sm:w-32"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    N.º pista
                  </span>
                  <span className="mt-1 text-5xl font-extrabold leading-none tabular-nums tracking-tighter sm:text-6xl text-white">
                    {entry.trackPosition}
                  </span>
                  {entry.horseName ? (
                    <span className="mt-2 line-clamp-2 text-center text-[10px] font-medium leading-tight text-slate-300">
                      {entry.horseName}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div
            className="pegaso-tie-fade mt-11 mx-auto flex max-w-lg flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-lg sm:flex-row"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="flex items-center gap-3">
              <span className="relative flex size-3 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-70" />
                <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
              </span>
              <span className="text-sm font-semibold text-slate-900">Resolución de empate</span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              {waitingLabel}
              {phase === "awaiting_director" ? (
                <span className="ml-0.5 inline-block w-5 text-left font-bold text-slate-900">
                  {".".repeat(dots)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    );
  }
