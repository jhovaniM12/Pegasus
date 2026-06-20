"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConsolidateFaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConsolidateFaDialog({
  open,
  onOpenChange,
  busy = false,
  onConfirm,
}: ConsolidateFaDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-5">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="size-6 text-amber-600" />
          </div>
          <DialogHeader className="gap-0 text-left">
            <DialogTitle className="text-lg font-semibold text-slate-950">
              Consolidar Formato FA
            </DialogTitle>
          </DialogHeader>
        </div>

        <p className="text-sm leading-relaxed text-slate-600">
          ¿Está seguro de consolidar el Formato FA? Esta acción no se puede deshacer y marcará el
          final de la fase de preselección.
        </p>

        <DialogFooter className="gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {busy ? "Procesando..." : "Confirmar Consolidación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
