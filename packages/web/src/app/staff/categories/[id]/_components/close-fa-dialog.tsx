"use client";

import { CircleCheck, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CloseFaSummary = {
  selectedCount: number;
  maxSelected: number;
  disqualifiedCount: number;
  discardedCount: number;
};

type CloseFaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: CloseFaSummary;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
};

function SummaryMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-center">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${valueClassName ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}

export function CloseFaDialog({
  open,
  onOpenChange,
  summary,
  busy = false,
  onConfirm,
}: CloseFaDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] gap-6 p-6 sm:max-w-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-600">
            <Lock className="size-6 text-white" />
          </div>
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle className="text-lg">Cerrar Formato FA</DialogTitle>
            <p className="text-sm leading-relaxed text-slate-500">
              Confirmación requerida para finalizar tu preselección
            </p>
          </DialogHeader>
        </div>

        <p className="text-sm leading-7 text-slate-600">
          ¿Estás seguro de que deseas cerrar el formato FA? Una vez cerrado, no podrás modificar tus
          selecciones y el formato quedará bloqueado permanentemente.
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CircleCheck className="size-4 text-blue-600" />
            Resumen de Selecciones
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <SummaryMetric
              label="Seleccionados"
              value={`${summary.selectedCount} / ${summary.maxSelected}`}
              valueClassName="text-amber-600"
            />
            <SummaryMetric
              label="Descalificados"
              value={`${summary.disqualifiedCount}`}
              valueClassName="text-red-600"
            />
            <SummaryMetric
              label="Descartados"
              value={`${summary.discardedCount}`}
              valueClassName="text-slate-600"
            />
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 border-l-4 bg-blue-50/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <Info className="size-4 shrink-0 text-blue-600" />
            Esta acción realizará lo siguiente:
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-blue-900/90">
            <li className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-blue-600" />
              Guardará todas tus selecciones de forma permanente.
            </li>
            <li className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-blue-600" />
              Marcará el formato como cerrado y bloqueado.
            </li>
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-blue-600" />
              No se podrá revertir esta acción.
            </li>
          </ul>
        </div>

        <DialogFooter className="mt-2 gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy} className="min-w-28">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className="min-w-40 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Lock className="size-4" />
            {busy ? "Procesando..." : "Confirmar Cierre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
