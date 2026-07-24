"use client";

import { AlertCircle, Check, FileSpreadsheet, RefreshCcw } from "lucide-react";

import { ImportIssuesTable } from "@/components/sync/import-issues-table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FedequinasPreview } from "@/types/sync";

type ImportPreviewProps = {
  preview: FedequinasPreview;
  fileName: string;
  applying: boolean;
  onChange: () => void;
  onConfirm: () => Promise<void>;
};

const countDefinitions = [
  { key: "total", label: "Filas" },
  { key: "inserts", label: "Nuevos" },
  { key: "updates", label: "Actualizaciones" },
  { key: "skips", label: "Sin cambios" },
  { key: "warnings", label: "Advertencias" },
  { key: "errors", label: "Errores" },
] as const;

export function ImportPreview({
  preview,
  fileName,
  applying,
  onChange,
  onConfirm,
}: ImportPreviewProps) {
  const hasErrors = preview.counts.errors > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <FileSpreadsheet className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{fileName}</span>
        <Badge variant="outline">Feria {preview.detectedFairExternalId}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {countDefinitions.map(({ key, label }) => (
          <div key={key} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{preview.counts[key]}</p>
          </div>
        ))}
      </div>

      {hasErrors && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>Corrige los errores bloqueantes y analiza de nuevo antes de confirmar.</p>
        </div>
      )}

      <Accordion>
        <AccordionItem value="detected-headers">
          <AccordionTrigger>Encabezados detectados ({preview.headers.length})</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-1.5">
              {preview.headers.map((header) => (
                <Badge key={header} variant="outline" className="font-mono text-xs">
                  {header}
                </Badge>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <ImportIssuesTable issues={preview.issues} fileName={fileName} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onChange} disabled={applying}>
          <RefreshCcw className="size-4" />
          Cambiar archivo
        </Button>
        <Button onClick={() => void onConfirm()} disabled={hasErrors || applying}>
          <Check className="size-4" />
          Confirmar y aplicar
        </Button>
      </div>
    </div>
  );
}
