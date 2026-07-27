"use client";

import { useMemo, useState } from "react";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DisqualificationReason } from "@/types/staged-flow";

export type VetRejectTarget = {
  fairEntryId: string;
  trackPosition: number;
  horseName: string;
};

type VetRejectDialogProps = {
  open: boolean;
  target: VetRejectTarget | null;
  reasons: DisqualificationReason[];
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (fairEntryId: string, reasonId: string) => Promise<void>;
};

function VetRejectDialogBody({
  target,
  reasons,
  busy = false,
  onOpenChange,
  onConfirm,
}: {
  target: VetRejectTarget;
  reasons: DisqualificationReason[];
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (fairEntryId: string, reasonId: string) => Promise<void>;
}) {
  const [reasonId, setReasonId] = useState("");
  const selectedReason = reasons.find((reason) => reason.id === reasonId) ?? null;

  const groupedReasons = useMemo(() => {
    const groups = new Map<string, DisqualificationReason[]>();
    for (const reason of reasons) {
      const key = reason.category?.trim() || "Otros motivos";
      const current = groups.get(key) ?? [];
      current.push(reason);
      groups.set(key, current);
    }
    return [...groups.entries()];
  }, [reasons]);

  const handleConfirm = async () => {
    if (!selectedReason) return;
    await onConfirm(target.fairEntryId, selectedReason.id);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <Stethoscope className="size-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950 sm:text-lg">
              Motivo de rechazo en prepista
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona la causal veterinaria según el reglamento de prepista.
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              Ejemplar #{target.trackPosition}
              {target.horseName ? ` · ${target.horseName}` : ""}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          Cerrar
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="space-y-6">
          {groupedReasons.map(([category, items]) => (
            <section key={category}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {category}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((reason) => {
                  const isSelected = reason.id === reasonId;
                  return (
                    <button
                      key={reason.id}
                      type="button"
                      disabled={busy}
                      onClick={() => setReasonId(reason.id)}
                      className={cn(
                        "rounded-xl border bg-white p-4 text-left transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300",
                        isSelected
                          ? "border-red-500 bg-red-50/40 shadow-sm ring-2 ring-red-200"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500">Motivo {reason.code}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-snug text-slate-950">{reason.name}</p>
                      {reason.description && (
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">{reason.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={handleConfirm} disabled={busy || !selectedReason}>
          {busy ? "Guardando..." : "Confirmar no aprobado"}
        </Button>
      </div>
    </>
  );
}

export function VetRejectDialog({
  open,
  target,
  reasons,
  busy = false,
  onOpenChange,
  onConfirm,
}: VetRejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
      >
        {open && target ? (
          <VetRejectDialogBody
            key={target.fairEntryId}
            target={target}
            reasons={reasons}
            busy={busy}
            onOpenChange={onOpenChange}
            onConfirm={onConfirm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
