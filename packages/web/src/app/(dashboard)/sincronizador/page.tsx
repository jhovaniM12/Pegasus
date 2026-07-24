"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, History, Search, Trash2, Unlink } from "lucide-react";

import {
  IMPORT_STEP_DEFINITIONS,
  ImportStepper,
} from "@/components/sync/import-stepper";
import { PageLoader } from "@/components/loaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useFedequinasSync } from "@/hooks/use-sync";
import type {
  FedequinasFileKind,
  FedequinasImportStatus,
  SyncBatch,
  SyncBatchStatus,
} from "@/types/sync";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const busyImportStatuses = new Set<FedequinasImportStatus>([
  "UPLOADING",
  "PARSING",
  "ANALYZING",
  "APPLYING",
]);

const fileKindLabels = new Map(
  IMPORT_STEP_DEFINITIONS.map((definition) => [definition.fileKind, definition.title])
);

function formatDate(value: string | null | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function statusVariant(status: SyncBatchStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "COMPLETED_WITH_ERRORS":
      return "secondary";
    case "FAILED":
      return "destructive";
    case "PROCESSING":
      return "outline";
    default: {
      const exhaustiveStatus: never = status;
      return exhaustiveStatus;
    }
  }
}

function statusLabel(status: SyncBatchStatus): string {
  const labels: Record<SyncBatchStatus, string> = {
    PROCESSING: "Procesando",
    COMPLETED: "Completado",
    COMPLETED_WITH_ERRORS: "Con errores",
    FAILED: "Fallido",
  };

  return labels[status];
}

function fileKindLabel(fileKind: SyncBatch["fileKind"]): string {
  return (fileKind ? fileKindLabels.get(fileKind) : undefined) ?? fileKind ?? "Importación CSV";
}

function SyncBatchHistoryTable({
  batches,
  fairExternalId,
}: {
  batches: SyncBatch[];
  fairExternalId: string | null;
}) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" />
          Historial Fedequinas
        </CardTitle>
        <CardDescription>
          {fairExternalId
            ? `Ejecuciones de la feria ${fairExternalId}.`
            : "Selecciona una feria para filtrar el historial."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Advertencias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No hay ejecuciones para esta feria.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{fileKindLabel(batch.fileKind)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(batch.status)}>{statusLabel(batch.status)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{batch.fileName}</TableCell>
                    <TableCell>{formatDate(batch.startedAt)}</TableCell>
                    <TableCell className="text-right">{batch.totalRows}</TableCell>
                    <TableCell className="text-right">{batch.warningRows ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncCleanupDialog({
  cleaning,
  disabled,
  onCleanup,
}: {
  cleaning: boolean;
  disabled?: boolean;
  onCleanup: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  async function handleCleanup() {
    await onCleanup();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" disabled={disabled || cleaning} />}>
        <Trash2 className="size-4" />
        Limpiar datos de desarrollo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar limpieza</DialogTitle>
          <DialogDescription>
            Esta acción elimina datos sincronizados y operativos de desarrollo (ferias, personal de
            feria, personas, usuarios de staff con código de acceso, inscripciones, ejemplares,
            juzgamiento y lotes de sync). Conserva catálogos base y usuarios ROOT/ADMIN.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>La acción no está disponible en producción y no se puede deshacer.</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button variant="destructive" onClick={() => void handleCleanup()} disabled={cleaning}>
            {cleaning ? "Limpiando..." : "Confirmar limpieza"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SyncDashboardPage() {
  const {
    steps,
    activeFairExternalId,
    knownFairExternalIds,
    filteredBatches,
    loading,
    error,
    announcement,
    cleaning,
    selectFair,
    selectFile,
    analyze,
    clearPreview,
    apply,
    cleanup,
  } = useFedequinasSync();
  const { toast } = useToast();
  const [fairInput, setFairInput] = useState("");
  const isDevelopment = process.env.NODE_ENV !== "production";
  const fairOptions = useMemo(
    () =>
      Array.from(
        new Set(
          activeFairExternalId
            ? [activeFairExternalId, ...knownFairExternalIds]
            : knownFairExternalIds
        )
      ),
    [activeFairExternalId, knownFairExternalIds]
  );
  const operationInProgress = steps.some((step) => busyImportStatuses.has(step.status));

  async function handleAnalyze(fileKind: FedequinasFileKind) {
    try {
      await analyze(fileKind);
    } catch (requestError) {
      toast({
        title: "No se pudo analizar el archivo",
        description: requestError instanceof Error ? requestError.message : undefined,
        variant: "error",
      });
    }
  }

  async function handleApply(fileKind: FedequinasFileKind) {
    try {
      const applied = await apply(fileKind);
      if (applied) toast({ title: "Importación aplicada", variant: "success" });
    } catch (requestError) {
      toast({
        title: "No se pudo aplicar la importación",
        description: requestError instanceof Error ? requestError.message : undefined,
        variant: "error",
      });
    }
  }

  async function handleCleanup() {
    try {
      await cleanup();
      setFairInput("");
      toast({ title: "Datos de desarrollo limpiados", variant: "success" });
    } catch {
      toast({
        title: "No se pudo ejecutar la limpieza",
        variant: "error",
      });
    }
  }

  if (loading) return <PageLoader fullScreen={false} label="Cargando estado de Fedequinas..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Importador Fedequinas
          </h1>
          <p className="text-sm text-muted-foreground">
            Importa una feria en cuatro pasos ordenados, revisa los cambios y confirma cada archivo.
          </p>
        </div>
        {isDevelopment && (
          <SyncCleanupDialog
            cleaning={cleaning}
            disabled={operationInProgress}
            onCleanup={handleCleanup}
          />
        )}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="size-5" />
            Feria activa
          </CardTitle>
          <CardDescription>
            Retoma una feria conocida o escribe su identificador. Si empiezas una nueva, se detectará
            al analizar el primer archivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="known-fair">Ferias recientes</Label>
              <Select
                value={activeFairExternalId ?? ""}
                onValueChange={(value) => void selectFair(value)}
                disabled={operationInProgress || cleaning}
              >
                <SelectTrigger id="known-fair" className="w-full">
                  <SelectValue placeholder="Seleccionar feria" />
                </SelectTrigger>
                <SelectContent>
                  {fairOptions.map((fairExternalId) => (
                    <SelectItem key={fairExternalId} value={fairExternalId}>
                      Feria {fairExternalId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void selectFair(fairInput);
              }}
            >
              <Label htmlFor="fair-external-id">Retomar por ID de feria</Label>
              <div className="flex gap-2">
                <Input
                  id="fair-external-id"
                  value={fairInput}
                  onChange={(event) => setFairInput(event.target.value)}
                  placeholder="Ej. 2026-001"
                  disabled={operationInProgress || cleaning}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!fairInput.trim() || operationInProgress || cleaning}
                >
                  <Search className="size-4" />
                  Retomar
                </Button>
              </div>
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={activeFairExternalId ? "default" : "outline"}>
              {activeFairExternalId ? `Feria ${activeFairExternalId}` : "Nueva feria"}
            </Badge>
            {activeFairExternalId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void selectFair(null)}
                disabled={operationInProgress || cleaning}
              >
                <Unlink className="size-4" />
                Empezar otra feria
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ImportStepper
        steps={steps}
        fairExternalId={activeFairExternalId}
        onFileSelect={selectFile}
        onAnalyze={handleAnalyze}
        onClearPreview={clearPreview}
        onApply={handleApply}
      />

      <SyncBatchHistoryTable batches={filteredBatches} fairExternalId={activeFairExternalId} />
    </div>
  );
}
