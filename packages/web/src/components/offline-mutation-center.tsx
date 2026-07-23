"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OfflineMutation } from "@/offline/schema";
import {
  discardOfflineMutation,
  listMutationsForStage,
  listMutationsForUser,
  recoverStaleSyncingMutations,
  retryOfflineMutation,
} from "@/offline/offline-repository";
import { getLastSuccessfulSyncAt } from "@/offline/retention";
import { OFFLINE_MUTATIONS_CHANGED_EVENT } from "@/offline/offline-events";

type Props = {
  userId: string;
  /** Si se omite, lista y opera sobre todas las mutaciones del usuario. */
  stageId?: string;
  onSync: () => Promise<void>;
};

function labelForStatus(status: OfflineMutation["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "SYNCING":
      return "Sincronizando";
    case "CONFLICT":
      return "Conflicto";
    case "FAILED":
      return "Fallida";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function labelForOperation(operationType: string): string {
  switch (operationType) {
    case "UPDATE_VET_CHECK":
      return "Checkeo veterinario";
    case "UPDATE_FA_SELECTION":
      return "Selección FA";
    case "UPDATE_ROUND_FORM":
      return "Tarjeta de ronda";
    case "UPDATE_ROUND_NOTE":
      return "Nota privada";
    case "UPDATE_ROUND_REMINDERS":
      return "Recordatorios";
    default:
      return operationType;
  }
}

function isRevisionConflict(mutation: OfflineMutation): boolean {
  return mutation.lastErrorCode === "REVISION_CONFLICT";
}

function numberArrayFrom(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

function faConflictSelections(mutation: OfflineMutation): {
  server: number[];
  local: number[];
} | null {
  if (mutation.operationType !== "UPDATE_FA_SELECTION") return null;

  const details =
    mutation.lastErrorDetails && typeof mutation.lastErrorDetails === "object"
      ? (mutation.lastErrorDetails as Record<string, unknown>)
      : null;
  const currentState =
    details?.currentState && typeof details.currentState === "object"
      ? (details.currentState as Record<string, unknown>)
      : null;
  const payload =
    mutation.payload && typeof mutation.payload === "object"
      ? (mutation.payload as Record<string, unknown>)
      : null;
  if (
    !Array.isArray(currentState?.selectedTrackPositions) ||
    !Array.isArray(payload?.selectedTrackPositions)
  ) {
    return null;
  }

  return {
    server: numberArrayFrom(currentState?.selectedTrackPositions),
    local: numberArrayFrom(payload?.selectedTrackPositions),
  };
}

function formatTrackPositions(positions: number[]): string {
  if (positions.length === 0) return "Ningún ejemplar";
  return positions.map((position) => `#${position}`).join(", ");
}

export function OfflineMutationCenter({ userId, stageId, onSync }: Props) {
  const [mutations, setMutations] = useState<OfflineMutation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const refresh = useCallback(async () => {
    await recoverStaleSyncingMutations(userId, stageId);
    const next = stageId
      ? await listMutationsForStage(userId, stageId)
      : await listMutationsForUser(userId);
    setMutations(next);
    setLastSyncAt(await getLastSuccessfulSyncAt());
  }, [stageId, userId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2_000);
    const onChanged = () => void refresh();
    window.addEventListener(OFFLINE_MUTATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(OFFLINE_MUTATIONS_CHANGED_EVENT, onChanged);
    };
  }, [refresh]);

  const runRetry = async (mutation: OfflineMutation, reapplyLocal = false) => {
    const faSelections =
      reapplyLocal && isRevisionConflict(mutation) ? faConflictSelections(mutation) : null;
    if (
      faSelections &&
      !window.confirm(
        `¿Guardar tu selección pendiente? Quedarán seleccionados: ${formatTrackPositions(
          faSelections.local
        )}. Esta acción reemplazará la selección actualmente guardada en Pegaso.`
      )
    ) {
      return;
    }
    setBusyId(mutation.operationId);
    try {
      await retryOfflineMutation(mutation.operationId, { reapplyLocal });
      await onSync();
    } finally {
      await refresh();
      setBusyId(null);
    }
  };

  const discard = async (mutation: OfflineMutation) => {
    const faConflict = isRevisionConflict(mutation) && faConflictSelections(mutation) != null;
    const confirmed = window.confirm(
      faConflict
        ? "¿Usar la selección guardada en Pegaso? La selección pendiente de este dispositivo se descartará y esta acción no se puede deshacer."
        : "¿Descartar este cambio local? El estado oficial del servidor se conservará y esta acción no se puede deshacer."
    );
    if (!confirmed) return;
    setBusyId(mutation.operationId);
    try {
      await discardOfflineMutation(mutation.operationId);
      await onSync();
    } finally {
      await refresh();
      setBusyId(null);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    try {
      await onSync();
    } finally {
      await refresh();
      setSyncingAll(false);
    }
  };

  if (mutations.length === 0) {
    return (
      <div className="p-3 text-sm text-slate-600" aria-label="Cambios offline">
        <p className="font-medium text-slate-800">Todo sincronizado</p>
        <p className="mt-1 text-xs text-slate-500">
          No hay cambios pendientes en este dispositivo
          {stageId ? " para esta categoría" : ""}.
        </p>
        {lastSyncAt && (
          <p className="mt-1 text-xs text-slate-500">
            Última sincronización exitosa: {new Date(lastSyncAt).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-3" aria-label="Cambios offline">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-950">Cambios pendientes de este dispositivo</p>
        <Button type="button" size="xs" variant="outline" disabled={syncingAll} onClick={() => void syncAll()}>
          <RotateCcw className={`size-3.5 ${syncingAll ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        El sincronizador envía estos cambios a Pegaso. Descartar conserva el estado oficial del servidor.
      </p>
      {lastSyncAt && (
        <p className="mt-1 text-xs text-slate-500">
          Última sincronización exitosa: {new Date(lastSyncAt).toLocaleString()}
        </p>
      )}
      <div className="mt-3 space-y-2">
        {mutations.map((mutation) => {
          const expanded = expandedId === mutation.operationId;
          const busy = busyId === mutation.operationId;
          const revisionConflict = isRevisionConflict(mutation);
          const faSelections = revisionConflict ? faConflictSelections(mutation) : null;
          return (
            <div key={mutation.operationId} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setExpandedId(expanded ? null : mutation.operationId)}
              >
                <span>
                  <span className="font-medium">{labelForOperation(mutation.operationType)}</span>
                  <span className="ml-2 text-amber-700">{labelForStatus(mutation.status)}</span>
                </span>
                <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {mutation.lastErrorMessage && (
                    <p className="mt-1 text-xs text-red-700">
                      {faSelections
                        ? "No pudimos guardar esta selección porque el formulario cambió mientras trabajabas."
                        : mutation.lastErrorMessage}
                    </p>
                  )}
                  {faSelections && (
                    <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-900">
                      <p className="font-medium">Compara antes de elegir:</p>
                      <dl className="mt-2 space-y-2">
                        <div>
                          <dt className="text-red-700">Guardado actualmente en Pegaso</dt>
                          <dd className="font-semibold">{formatTrackPositions(faSelections.server)}</dd>
                        </div>
                        <div>
                          <dt className="text-red-700">Pendiente en este dispositivo</dt>
                          <dd className="font-semibold">{formatTrackPositions(faSelections.local)}</dd>
                        </div>
                      </dl>
                      <p className="mt-2">
                        Puedes guardar tu selección pendiente o conservar la que ya está en Pegaso.
                      </p>
                    </div>
                  )}
                  {revisionConflict && !faSelections && (
                    <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-900">
                      El registro cambió en Pegaso. Decide si deseas guardar el cambio de este
                      dispositivo o conservar el estado actual.
                    </p>
                  )}
                  <details className="mt-2 text-xs text-slate-700">
                    <summary className="cursor-pointer">Detalles técnicos para soporte</summary>
                    <p className="mt-2">Operación: {mutation.operationId}</p>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(
                        {
                          error: mutation.lastErrorDetails,
                          cambioLocal: mutation.payload,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(mutation.status === "FAILED" || (mutation.status === "CONFLICT" && !revisionConflict)) && (
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runRetry(mutation)}>
                        <RotateCcw className="size-4" /> Reintentar
                      </Button>
                    )}
                    {revisionConflict && mutation.status === "CONFLICT" && (
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runRetry(mutation, true)}>
                        <RotateCcw className="size-4" /> {faSelections ? "Guardar mi selección" : "Guardar mi cambio"}
                      </Button>
                    )}
                    {mutation.status !== "SYNCING" && (
                      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void discard(mutation)}>
                        <Trash2 className="size-4" /> {faSelections ? "Usar la selección de Pegaso" : "Descartar cambio local"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
