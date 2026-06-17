"use client";

import { ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { DisqualificationReason, RoundParticipant } from "@/types/staged-flow";

type RoundDisqualifyDialogProps = {
  open: boolean;
  participant: RoundParticipant | null;
  reasons: DisqualificationReason[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (participantId: string, reasonId: string) => Promise<void>;
};

export function RoundDisqualifyDialog({
  open,
  participant,
  reasons,
  busy,
  onOpenChange,
  onConfirm,
}: RoundDisqualifyDialogProps) {
  const [reasonId, setReasonId] = useState("");

  useEffect(() => {
    if (open) {
      setReasonId("");
    }
  }, [participant, open]);

  const selectedReason = reasons.find((reason) => reason.id === reasonId) ?? null;

  const handleConfirm = async () => {
    if (!participant || !selectedReason) return;
    await onConfirm(participant.id, selectedReason.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="size-5 text-red-600" />
            Descalificar ejemplar
            {participant ? ` #${participant.trackPosition}` : ""}
          </DialogTitle>
          <DialogDescription>
            Este ejemplar quedará fuera de la competencia de forma inmediata y no podrá ser seleccionado ni
            ubicado por ningún juez.
          </DialogDescription>
        </DialogHeader>

        {participant && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">{participant.riderName}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{participant.registrationNumber}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="round-disqualify-reason">Motivo de descalificación</Label>
          <select
            id="round-disqualify-reason"
            value={reasonId}
            onChange={(event) => setReasonId(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-shadow focus:border-red-300 focus:ring-2 focus:ring-red-100"
          >
            <option value="">Seleccionar motivo</option>
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.code} – {reason.name}
              </option>
            ))}
          </select>
          {selectedReason?.description && (
            <p className="text-xs text-slate-500">{selectedReason.description}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={busy || !participant || !selectedReason}
          >
            {busy ? "Descalificando..." : "Confirmar descalificación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
