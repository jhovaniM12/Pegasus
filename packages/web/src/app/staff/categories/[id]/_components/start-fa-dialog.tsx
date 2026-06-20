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

type StartFaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gaitLabel: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function StartFaDialog({
  open,
  onOpenChange,
  gaitLabel,
  busy = false,
  onConfirm,
}: StartFaDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <Play className="size-5 text-emerald-600" />
          </div>
          <DialogHeader className="gap-0 text-left">
            <DialogTitle className="text-base">Iniciar Formato FA</DialogTitle>
          </DialogHeader>
        </div>

        <p className="text-sm leading-relaxed text-slate-700">
          ¿Estás seguro de que deseas iniciar el formato FA para este andar?
        </p>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <CircleCheck className="size-4 shrink-0 text-emerald-600" />
            Esta acción:
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900/90">
            <li>Iniciará el formato FA para este andar</li>
            <li>Te permitirá comenzar a evaluar los ejemplares</li>
          </ul>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          Andar: <span className="font-medium text-slate-800">{gaitLabel}</span>
        </p>

        <DialogFooter className="mt-1 flex-row justify-end gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {busy ? "Procesando..." : "Confirmar Inicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
