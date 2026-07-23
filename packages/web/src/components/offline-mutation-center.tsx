"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OfflineMutation } from "@/offline/schema";
import {
  discardOfflineMutation,
  listMutationsForStage,
  recoverStaleSyncingMutations,
  retryOfflineMutation,
} from "@/offline/offline-repository";
import { getLastSuccessfulSyncAt } from "@/offline/retention";

type Props = {
  userId: string;
  stageId: string;
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

export function OfflineMutationCenter({ userId, stageId, onSync }: Props) {
  const [mutations, setMutations] = useState<OfflineMutation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const refresh = useCallback(async () => {
    await recoverStaleSyncingMutations(userId, stageId);
    setMutations(await listMutationsForStage(userId, stageId));
    setLastSyncAt(await getLastSuccessfulSyncAt());
  }, [stageId, userId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const runRetry = async (mutation: OfflineMutation, reapplyLocal = false) => {
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
    const confirmed = window.confirm(
      "Descartar este cambio local? El estado oficial del servidor se conservará y esta acción no se puede deshacer."
    );
    if (!confirmed) return;
    setBusyId(mutation.operationId);
    try {
      await discardOfflineMutation(mutation.operationId);
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
          No hay cambios pendientes en este dispositivo para esta categoría.
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
        Revisa los cambios antes de cerrar la etapa. Descartar conserva el estado oficial del servidor.
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
                  <p className="text-xs text-slate-600">Operación: {mutation.operationId}</p>
                  {mutation.lastErrorMessage && (
                    <p className="mt-1 text-xs text-red-700">{mutation.lastErrorMessage}</p>
                  )}
                  {revisionConflict && (
                    <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-900">
                      <p>Estado oficial reportado por el servidor:</p>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(mutation.lastErrorDetails, null, 2)}
                      </pre>
                      <p className="mt-1">Puedes conservarlo descartando el cambio local, o re-aplicar explícitamente tu borrador.</p>
                    </div>
                  )}
                  <details className="mt-2 text-xs text-slate-700">
                    <summary className="cursor-pointer">Ver cambio local</summary>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">{JSON.stringify(mutation.payload, null, 2)}</pre>
                  </details>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(mutation.status === "FAILED" || (mutation.status === "CONFLICT" && !revisionConflict)) && (
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runRetry(mutation)}>
                        <RotateCcw className="size-4" /> Reintentar
                      </Button>
                    )}
                    {revisionConflict && mutation.status === "CONFLICT" && (
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runRetry(mutation, true)}>
                        <RotateCcw className="size-4" /> Re-aplicar cambio local
                      </Button>
                    )}
                    {mutation.status !== "SYNCING" && (
                      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void discard(mutation)}>
                        <Trash2 className="size-4" /> Descartar cambio local
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
