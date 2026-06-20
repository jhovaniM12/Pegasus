"use client";

import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActivateRoundConfig } from "./activate-round-card";

type ActivateRoundDialogProps = {
  open: boolean;
  config: ActivateRoundConfig | null;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
};

function activationMessage(roundType: ActivateRoundConfig["roundType"]): string {
  if (roundType === "F1") {
    return "¿Está seguro de activar el Formato F1? Todos los jueces podrán comenzar a realizar sus selecciones con recordatorios.";
  }

  return "¿Está seguro de activar el Formato F2? Todos los jueces podrán comenzar a asignar los puestos finales de la categoría.";
}

export function ActivateRoundDialog({
  open,
  config,
  onOpenChange,
  busy = false,
  onConfirm,
}: ActivateRoundDialogProps) {
  if (!config) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-5">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-violet-100">
            <Trophy className="size-6 text-violet-600" />
          </div>
          <DialogHeader className="gap-0 text-left">
            <DialogTitle className="text-lg font-semibold text-slate-950">
              Activar Formato {config.roundType}
            </DialogTitle>
          </DialogHeader>
        </div>

        <p className="text-sm leading-relaxed text-slate-600">{activationMessage(config.roundType)}</p>

        <DialogFooter className="gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {busy ? "Procesando..." : "Confirmar Activación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
