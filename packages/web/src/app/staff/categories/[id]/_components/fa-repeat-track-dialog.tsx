"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FaParticipant } from "@/types/staged-flow";

type FaRepeatTrackDialogProps = {
  open: boolean;
  participant: FaParticipant | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (participantId: string) => Promise<void>;
};

export function FaRepeatTrackDialog({
  open,
  participant,
  busy = false,
  onOpenChange,
  onConfirm,
}: FaRepeatTrackDialogProps) {
  const handleConfirm = async () => {
    if (!participant) return;
    await onConfirm(participant.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-5 text-amber-600" />
            Confirmar solicitud de repetir pista
          </DialogTitle>
          <DialogDescription>
            Se enviará una solicitud al Director Técnico para repetir pista de este ejemplar.
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-slate-500">
          Al confirmar, se enviará una notificación push inmediata.
        </p>

        {participant && (
          <div className="mt-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
            <span className="font-medium text-amber-900">Ejemplar seleccionado</span>
            <span className="font-bold text-amber-950">#{participant.trackPosition}</span>
          </div>
        )}

        <DialogFooter className="mt-4 flex-row justify-end gap-2 sm:mt-6 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || !participant}
            className="w-full bg-amber-600 text-white hover:bg-amber-700 sm:w-auto"
          >
            {busy ? "Enviando..." : "Confirmar y enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
