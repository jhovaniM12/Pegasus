"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileWarning, History, Play, Trash2, Upload } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useSyncDashboard } from "@/hooks/use-sync";
import type { SyncBatch, SyncBatchStatus, SyncEntityName, SyncError, SyncSummary } from "@/types/sync";

const SYNC_ENTITIES: Array<{
  entityName: SyncEntityName;
  title: string;
  fileLabel: string;
  description: string;
}> = [
  {
    entityName: "people",
    title: "People",
    fileLabel: "FEB_PERSONAL",
    description: "Personas registradas en Fedequinas para roles operativos.",
  },
  {
    entityName: "horses",
    title: "Horses",
    fileLabel: "INFORMACION_EJEMPLARES",
    description: "Maestro de ejemplares identificado por NUMERO_REGISTRO.",
  },
  {
    entityName: "fair_staff",
    title: "Fair Staff",
    fileLabel: "FEH_PERSONAL_FERIA",
    description: "Personal asignado a ferias con rol operativo.",
  },
  {
    entityName: "fair_entries",
    title: "Fair Entries",
    fileLabel: "FEH_INSCRIPCIONES_FERIA",
    description: "Inscripciones relacionadas con ejemplares mediante NUMERO_REGISTRO.",
  },
];

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVariant(status: SyncBatchStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED") return "default";
  if (status === "COMPLETED_WITH_ERRORS") return "secondary";
  if (status === "FAILED") return "destructive";
  return "outline";
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

function getSummary(entityName: SyncEntityName, summaries: SyncSummary[]): SyncSummary | null {
  return summaries.find((summary) => summary.entityName === entityName) ?? null;
}

function SyncUploadForm({
  entityName,
  disabled,
  onRun,
}: {
  entityName: SyncEntityName;
  disabled: boolean;
  onRun: (entityName: SyncEntityName, file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);

    if (!selectedFile) {
      setError(null);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Selecciona un archivo con extensión .csv.");
      return;
    }

    setError(null);
  }

  async function handleRun() {
    if (!file) {
      setError("Selecciona un CSV antes de ejecutar.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Selecciona un archivo con extensión .csv.");
      return;
    }

    await onRun(entityName, file);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={disabled} />
        <Button onClick={handleRun} disabled={disabled || !file || Boolean(error)}>
          <Play className="size-4" />
          Ejecutar
        </Button>
      </div>
      {file && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Upload className="size-3.5" />
          <span className="font-medium text-foreground">{file.name}</span>
          <span>{formatBytes(file.size)}</span>
        </div>
      )}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function SyncEntityCard({
  config,
  summary,
  running,
  onRun,
  onShowErrors,
}: {
  config: (typeof SYNC_ENTITIES)[number];
  summary: SyncSummary | null;
  running: boolean;
  onRun: (entityName: SyncEntityName, file: File) => Promise<void>;
  onShowErrors: (batch: SyncBatch) => void;
}) {
  const batch = summary?.lastBatch ?? null;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
        <CardAction>
          {batch ? (
            <Badge variant={statusVariant(batch.status)}>{statusLabel(batch.status)}</Badge>
          ) : (
            <Badge variant="outline">Sin ejecuciones</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Metric label="Archivo" value={config.fileLabel} />
          <Metric label="Última ejecución" value={formatDate(batch?.finishedAt ?? batch?.startedAt)} />
          <Metric label="Total" value={String(batch?.totalRows ?? 0)} />
          <Metric label="Insertados" value={String(batch?.insertedRows ?? 0)} />
          <Metric label="Actualizados" value={String(batch?.updatedRows ?? 0)} />
          <Metric label="Omitidos" value={String(batch?.skippedRows ?? 0)} />
          <Metric label="Fallidos" value={String(batch?.failedRows ?? 0)} />
        </div>
        <SyncUploadForm entityName={config.entityName} disabled={running} onRun={onRun} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!batch || batch.failedRows === 0}
            onClick={() => batch && onShowErrors(batch)}
          >
            <FileWarning className="size-3.5" />
            Ver errores del último lote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function SyncBatchHistoryTable({
  batches,
  onShowErrors,
}: {
  batches: SyncBatch[];
  onShowErrors: (batch: SyncBatch) => void;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" />
          Historial de lotes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Fallidos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No hay lotes registrados.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.entityName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(batch.status)}>{statusLabel(batch.status)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{batch.fileName}</TableCell>
                    <TableCell>{formatDate(batch.startedAt)}</TableCell>
                    <TableCell className="text-right">{batch.totalRows}</TableCell>
                    <TableCell className="text-right">{batch.failedRows}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={batch.failedRows === 0}
                        onClick={() => onShowErrors(batch)}
                      >
                        Errores
                      </Button>
                    </TableCell>
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

function SyncErrorsTable({
  batch,
  errors,
}: {
  batch: SyncBatch | null;
  errors: SyncError[];
}) {
  if (!batch) return null;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Errores del lote</CardTitle>
        <CardDescription>
          {batch.entityName} · {batch.fileName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fila</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Mensaje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Este lote no tiene errores registrados.
                  </TableCell>
                </TableRow>
              ) : (
                errors.map((error) => (
                  <TableRow key={error.id}>
                    <TableCell>{error.rowNumber}</TableCell>
                    <TableCell>{error.externalId || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{error.errorCode}</Badge>
                    </TableCell>
                    <TableCell>{error.errorMessage}</TableCell>
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
  onCleanup,
}: {
  cleaning: boolean;
  onCleanup: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  async function handleCleanup() {
    await onCleanup();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>
        <Trash2 className="size-4" />
        Limpiar datos de desarrollo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar limpieza</DialogTitle>
          <DialogDescription>
            Esta acción elimina datos sincronizados y operativos de desarrollo. No borra catálogos base.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>La acción no está disponible en producción y no se puede deshacer.</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button variant="destructive" onClick={handleCleanup} disabled={cleaning}>
            {cleaning ? "Limpiando..." : "Confirmar limpieza"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SyncDashboardPage() {
  const {
    summaries,
    batches,
    errors,
    selectedBatch,
    loading,
    runningEntity,
    cleaning,
    runSync,
    loadErrors,
    cleanup,
  } = useSyncDashboard();
  const { toast } = useToast();
  const isDevelopment = process.env.NODE_ENV !== "production";
  const totalFailed = useMemo(
    () => summaries.reduce((total, summary) => total + (summary.lastBatch?.failedRows ?? 0), 0),
    [summaries]
  );

  async function handleRun(entityName: SyncEntityName, file: File) {
    try {
      const batch = await runSync(entityName, file);
      toast({
        title: "Sincronización finalizada",
        description: batch
          ? `${batch.insertedRows} insertados, ${batch.updatedRows} actualizados, ${batch.skippedRows} omitidos, ${batch.failedRows} fallidos.`
          : undefined,
        variant: batch?.failedRows ? "notification" : "success",
      });
    } catch {
      toast({
        title: "No se pudo ejecutar la sincronización",
        description: "Revisa el archivo CSV y vuelve a intentarlo.",
        variant: "error",
      });
    }
  }

  async function handleCleanup() {
    try {
      await cleanup();
      toast({ title: "Datos de desarrollo limpiados", variant: "success" });
    } catch {
      toast({
        title: "No se pudo ejecutar la limpieza",
        variant: "error",
      });
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sincronizador</h1>
          <p className="text-sm text-muted-foreground">
            Carga CSV de Fedequinas, ejecuta sincronizaciones incrementales y revisa errores por lote.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={totalFailed > 0 ? "secondary" : "outline"} className="h-7">
            {totalFailed > 0 ? (
              <AlertTriangle className="size-3.5" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            {totalFailed} errores recientes
          </Badge>
          {isDevelopment && <SyncCleanupDialog cleaning={cleaning} onCleanup={handleCleanup} />}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {SYNC_ENTITIES.map((config) => (
          <SyncEntityCard
            key={config.entityName}
            config={config}
            summary={getSummary(config.entityName, summaries)}
            running={loading || runningEntity === config.entityName}
            onRun={handleRun}
            onShowErrors={(batch) => void loadErrors(batch)}
          />
        ))}
      </div>

      <SyncBatchHistoryTable batches={batches} onShowErrors={(batch) => void loadErrors(batch)} />
      <SyncErrorsTable batch={selectedBatch} errors={errors} />
    </div>
  );
}
