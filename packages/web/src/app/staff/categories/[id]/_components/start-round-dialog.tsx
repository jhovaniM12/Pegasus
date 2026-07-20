"use client";

import { CircleCheck, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JudgeFormatKey } from "@/types/staged-flow";

const ROUND_TITLES: Record<"F1" | "F2" | "TIE_BREAK", string> = {
  F1: "prueba individual",
  F2: "prueba individual",
  TIE_BREAK: "Formato desempate",
};

const ROUND_ACTIONS: Record<"F1" | "F2" | "TIE_BREAK", string[]> = {
  F1: [
    "Iniciará tu tarjeta de prueba individual para esta categoría",
    "Te permitirá seleccionar los ejemplares que pasan a la final",
  ],
  F2: [
    "Iniciará tu tarjeta de prueba individual para esta categoría",
    "Te permitirá asignar los puestos finales a los finalistas",
  ],
  TIE_BREAK: [
    "Iniciará tu tarjeta de desempate para esta categoría",
    "Te permitirá definir el orden entre los ejemplares empatados",
  ],
};

const ROUND_CONFIRM_QUESTIONS: Record<"F1" | "F2" | "TIE_BREAK", string> = {
  F1: "¿Estás seguro de que deseas iniciar el juzgamiento de prueba individual para esta categoría?",
  F2: "¿Estás seguro de que deseas iniciar el juzgamiento de prueba individual para esta categoría?",
  TIE_BREAK: "¿Estás seguro de que deseas iniciar el juzgamiento de desempate para esta categoría?",
};

const ROUND_CONFIRM_LABELS: Record<"F1" | "F2" | "TIE_BREAK", string> = {
  F1: "Iniciar prueba individual",
  F2: "Iniciar prueba individual",
  TIE_BREAK: "Confirmar Inicio",
};

type StartRoundDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundKey: Extract<JudgeFormatKey, "F1" | "F2" | "TIE_BREAK">;
  gaitLabel: string;
  participantCount?: number | null;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function StartRoundDialog({
  open,
  onOpenChange,
  roundKey,
  gaitLabel,
  participantCount,
  busy = false,
  onConfirm,
}: StartRoundDialogProps) {
  const title = ROUND_TITLES[roundKey];
  const actions = ROUND_ACTIONS[roundKey];
  const confirmQuestion = ROUND_CONFIRM_QUESTIONS[roundKey];
  const confirmLabel = ROUND_CONFIRM_LABELS[roundKey];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-50">
            <Play className="size-5 text-violet-600" />
          </div>
          <DialogHeader className="gap-0 text-left">
            <DialogTitle className="text-base">Iniciar {title}</DialogTitle>
          </DialogHeader>
        </div>

        <p className="text-sm leading-relaxed text-slate-700">{confirmQuestion}</p>

        <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
            <CircleCheck className="size-4 shrink-0 text-violet-600" />
            Esta acción:
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-violet-900/90">
            {actions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-1 text-xs leading-relaxed text-slate-600">
          <p>
            Andar: <span className="font-medium text-slate-800">{gaitLabel}</span>
          </p>
          {participantCount != null && (
            <p>
              Finalistas: <span className="font-medium text-slate-800">{participantCount}</span>
            </p>
          )}
        </div>

        <DialogFooter className="mt-1 flex-row justify-end gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() => void onConfirm()}
            disabled={busy}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            {busy ? "Procesando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
