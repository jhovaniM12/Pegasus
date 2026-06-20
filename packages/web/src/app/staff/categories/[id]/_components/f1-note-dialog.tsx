"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import type { RoundParticipant } from "@/types/staged-flow";

type F1NoteDialogProps = {
  open: boolean;
  participant: RoundParticipant | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (participantId: string, note: string | null) => Promise<void>;
};

function F1NoteDialogBody({
  participant,
  busy,
  onOpenChange,
  onSave,
}: {
  participant: RoundParticipant;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (participantId: string, note: string | null) => Promise<void>;
}) {
  const [note, setNote] = useState(participant.privateNote ?? "");

  const handleSave = async () => {
    const trimmed = note.trim();
    await onSave(participant.id, trimmed ? trimmed : null);
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="size-5 text-violet-600" />
          Agregar nota
        </DialogTitle>
        <DialogDescription>
          Ingresa una nota opcional para este ejemplar. La nota será guardada y visible solo para ti.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="f1-private-note">Nota (opcional)</Label>
        <Textarea
          id="f1-private-note"
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, 1000))}
          placeholder="Escribe aquí tu nota sobre este ejemplar..."
          rows={5}
          className="resize-none"
        />
        <p className="text-right text-xs text-slate-500">{note.length}/1000 caracteres</p>
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={busy}>
          {busy ? "Guardando..." : "Guardar nota"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function F1NoteDialog({
  open,
  participant,
  busy,
  onOpenChange,
  onSave,
}: F1NoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {participant ? (
          <F1NoteDialogBody
            key={participant.id}
            participant={participant}
            busy={busy}
            onOpenChange={onOpenChange}
            onSave={onSave}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
