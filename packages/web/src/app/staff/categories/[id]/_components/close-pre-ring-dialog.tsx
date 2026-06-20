"use client";

import { CircleCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClosePreRingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalProcessed: number;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ClosePreRingDialog({
  open,
  onOpenChange,
  totalProcessed,
  busy = false,
  onConfirm,
}: ClosePreRingDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <FileText className="size-5 text-blue-600" />
          </div>
          <DialogHeader className="gap-0 text-left">
            <DialogTitle className="text-base">Cerrar Prepista</DialogTitle>
          </DialogHeader>
        </div>

        <p className="text-sm leading-relaxed text-slate-700">
          ¿Estás seguro de que deseas cerrar la prepista para este andar?
        </p>

        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <CircleCheck className="size-4 shrink-0 text-blue-600" />
            Esta acción:
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-900/90">
            <li>Generará el documento de Chequeo Veterinario</li>
            <li>Marcará la prepista como cerrada</li>
            <li>No se podrá revertir</li>
          </ul>
        </div>

        <p className="text-sm text-slate-600">
          Total de ejemplares procesados:{" "}
          <span className="font-semibold text-slate-900">{totalProcessed}</span>
        </p>

        <DialogFooter className="mt-1 flex-row justify-end gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {busy ? "Procesando..." : "Confirmar Cierre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
