"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Search,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { ImportPreview } from "@/components/sync/import-preview";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  FedequinasFileKind,
  FedequinasImportStatus,
  FedequinasImportStep,
} from "@/types/sync";

type ImportStepCardProps = {
  number: number;
  title: string;
  description: string;
  expectedHeaders: readonly string[];
  step: FedequinasImportStep;
  fairExternalId: string | null;
  onFileSelect: (fileKind: FedequinasFileKind, file: File | null) => void;
  onAnalyze: (fileKind: FedequinasFileKind) => Promise<void>;
  onClearPreview: (fileKind: FedequinasFileKind) => void;
  onApply: (fileKind: FedequinasFileKind) => Promise<void>;
};

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const busyStatuses = new Set<FedequinasImportStatus>([
  "UPLOADING",
  "PARSING",
  "ANALYZING",
  "APPLYING",
]);

const resultCountDefinitions = [
  { key: "total", label: "Filas" },
  { key: "inserts", label: "Nuevos" },
  { key: "updates", label: "Actualizados" },
  { key: "skips", label: "Sin cambios" },
  { key: "warnings", label: "Advertencias" },
  { key: "errors", label: "Errores" },
] as const;

function formatDate(value: string | null | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : "Sin ejecuciones";
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusPresentation(status: FedequinasImportStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (status) {
    case "LOCKED":
      return { label: "Bloqueado", variant: "outline" };
    case "READY":
      return { label: "Listo", variant: "outline" };
    case "UPLOADING":
      return { label: "Subiendo", variant: "secondary" };
    case "PARSING":
      return { label: "Leyendo", variant: "secondary" };
    case "ANALYZING":
      return { label: "Analizando", variant: "secondary" };
    case "PREVIEW":
      return { label: "Por confirmar", variant: "secondary" };
    case "APPLYING":
      return { label: "Aplicando", variant: "secondary" };
    case "COMPLETED":
      return { label: "Completado", variant: "default" };
    case "COMPLETED_WITH_WARNINGS":
      return { label: "Con advertencias", variant: "secondary" };
    case "FAILED":
      return { label: "Fallido", variant: "destructive" };
    default: {
      const exhaustiveStatus: never = status;
      return exhaustiveStatus;
    }
  }
}

function StatusIcon({ status }: { status: FedequinasImportStatus }) {
  switch (status) {
    case "LOCKED":
      return <LockKeyhole className="size-4" />;
    case "READY":
      return <CircleDashed className="size-4" />;
    case "UPLOADING":
    case "PARSING":
    case "ANALYZING":
    case "APPLYING":
      return <LoaderCircle className="size-4 animate-spin" />;
    case "PREVIEW":
      return <Search className="size-4" />;
    case "COMPLETED":
      return <CheckCircle2 className="size-4" />;
    case "COMPLETED_WITH_WARNINGS":
      return <TriangleAlert className="size-4" />;
    case "FAILED":
      return <AlertCircle className="size-4" />;
    default: {
      const exhaustiveStatus: never = status;
      return exhaustiveStatus;
    }
  }
}

function ImportResult({ step }: { step: FedequinasImportStep }) {
  if (!step.batch) return null;
  const counts = step.batch.counts;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <FileCheck2 className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">
            {step.status === "COMPLETED_WITH_WARNINGS"
              ? "Importación aplicada con advertencias"
              : "Importación aplicada correctamente"}
          </p>
          <p className="text-sm text-muted-foreground">{step.batch.fileName}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {resultCountDefinitions.map(({ key, label }) => (
          <div key={key} className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{counts[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ImportStepCard({
  number,
  title,
  description,
  expectedHeaders,
  step,
  fairExternalId,
  onFileSelect,
  onAnalyze,
  onClearPreview,
  onApply,
}: ImportStepCardProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const presentation = statusPresentation(step.status);
  const isBusy = busyStatuses.has(step.status);
  const isComplete =
    step.status === "COMPLETED" || step.status === "COMPLETED_WITH_WARNINGS";
  const inputId = `fedequinas-file-${step.fileKind}`;

  useEffect(() => {
    if (step.status === "PREVIEW" || isComplete || step.status === "FAILED") {
      resultRef.current?.focus();
    }
  }, [isComplete, step.status]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setFileError(null);
      onFileSelect(step.fileKind, null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setFileError("Selecciona un archivo con extensión .xlsx.");
      onFileSelect(step.fileKind, null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("El archivo supera el tamaño máximo de 10 MB.");
      onFileSelect(step.fileKind, null);
      return;
    }
    setFileError(null);
    onFileSelect(step.fileKind, file);
  }

  return (
    <div
      ref={resultRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="relative scroll-mt-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={cn(
          "rounded-xl transition-colors",
          step.status === "LOCKED" && "bg-muted/30 opacity-75",
          step.status === "PREVIEW" && "border-primary/40"
        )}
      >
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                isComplete
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background"
              )}
              aria-hidden
            >
              {number}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paso {number} de 4
              </p>
              <CardTitle id={titleId} role="heading" aria-level={2} className="mt-0.5">
                {title}
              </CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <CardAction>
            <Badge variant={presentation.variant}>
              <span aria-hidden>
                <StatusIcon status={step.status} />
              </span>
              {presentation.label}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-5">
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Feria</dt>
              <dd className="font-medium">{fairExternalId ?? "Se detectará al analizar"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Última ejecución</dt>
              <dd className="font-medium">
                {formatDate(step.batch?.finishedAt ?? step.batch?.startedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Archivo aplicado</dt>
              <dd className="truncate font-medium">{step.batch?.fileName ?? "—"}</dd>
            </div>
          </dl>

          {step.status === "LOCKED" && (
            <div className="flex gap-3 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
              <LockKeyhole className="mt-0.5 size-4 shrink-0" />
              <p>Completa el paso anterior para habilitar esta importación.</p>
            </div>
          )}

          {(step.status === "READY" || step.status === "FAILED") && (
            <div className="space-y-4">
              {step.error && (
                <div role="alert" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{step.error}</p>
                </div>
              )}
              <Accordion>
                <AccordionItem value="expected-headers">
                  <AccordionTrigger>
                    Encabezados esperados ({expectedHeaders.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-1.5">
                      {expectedHeaders.map((header) => (
                        <Badge key={header} variant="outline" className="font-mono text-xs">
                          {header}
                        </Badge>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <div className="space-y-2">
                <Label htmlFor={inputId}>Archivo XLSX</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id={inputId}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileChange}
                    disabled={isBusy}
                    aria-invalid={Boolean(fileError)}
                    aria-describedby={fileError ? `${inputId}-error` : undefined}
                  />
                  <Button
                    onClick={() => void onAnalyze(step.fileKind)}
                    disabled={!step.file || Boolean(fileError) || isBusy}
                  >
                    <Search className="size-4" />
                    Analizar
                  </Button>
                </div>
                {fileError && (
                  <p id={`${inputId}-error`} className="text-xs font-medium text-destructive">
                    {fileError}
                  </p>
                )}
                {step.file && !fileError && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="size-3.5" />
                    <span className="font-medium text-foreground">{step.file.name}</span>
                    <span>{formatBytes(step.file.size)}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {step.status === "ANALYZING" && (
            <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-border p-4">
              <LoaderCircle className="size-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Analizando el archivo</p>
                <p className="text-sm text-muted-foreground">
                  Validando encabezados, referencias y cambios.
                </p>
              </div>
            </div>
          )}

          {step.status === "PREVIEW" && step.preview && step.file && (
            <ImportPreview
              preview={step.preview}
              fileName={step.file.name}
              applying={false}
              onChange={() => onClearPreview(step.fileKind)}
              onConfirm={() => onApply(step.fileKind)}
            />
          )}

          {step.status === "APPLYING" && (
            <div role="status" className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <LoaderCircle className="size-5 animate-spin text-primary" />
              <p className="font-medium">Aplicando datos validados…</p>
            </div>
          )}

          {isComplete && (
            <div className="space-y-4">
              <ImportResult step={step} />
              <Button variant="outline" onClick={() => onFileSelect(step.fileKind, null)}>
                <RotateCcw className="size-4" />
                Importar una versión nueva
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
