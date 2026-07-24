"use client";

import { FileSpreadsheet, LoaderCircle, ShieldAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ImportProcessingDialogProps = {
  open: boolean;
  mode: "analyzing" | "applying";
  fileName: string;
  fairExternalId: string | null;
  stepNumber: number;
  stepTitle: string;
};

export function ImportProcessingDialog({
  open,
  mode,
  fileName,
  fairExternalId,
  stepNumber,
  stepTitle,
}: ImportProcessingDialogProps) {
  const applying = mode === "applying";

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md"
        aria-describedby="fedequinas-processing-description"
        aria-busy="true"
      >
        <DialogHeader>
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
            <LoaderCircle className="size-7 animate-spin text-primary" aria-hidden />
          </div>
          <DialogTitle className="text-center">
            {applying ? "Aplicando importación" : "Analizando archivo"}
          </DialogTitle>
          <DialogDescription id="fedequinas-processing-description" className="text-center">
            {applying
              ? "Estamos guardando los datos validados de Fedequinas."
              : "Validando encabezados y filas del documento."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="size-4 text-muted-foreground" />
            <span className="truncate font-medium">{fileName}</span>
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Feria</dt>
            <dd className="font-medium">{fairExternalId ?? "Detectando..."}</dd>
            <dt className="text-muted-foreground">Paso</dt>
            <dd className="font-medium">
              {stepNumber} de 4 · {stepTitle}
            </dd>
          </dl>
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={applying ? "Aplicando importación" : "Analizando archivo"}
        >
          <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>

        {applying && (
          <div className="flex gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p className="font-medium">No cierres esta pestaña hasta que termine el proceso.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
