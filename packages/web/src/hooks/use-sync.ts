"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { syncService } from "@/services/sync.service";
import type { PaginationMeta } from "@/types/common";
import {
  FEDEQUINAS_FILE_KINDS,
  type FedequinasFairStatus,
  type FedequinasFileKind,
  type FedequinasImportStep,
  type FedequinasStepBatch,
  type SyncBatch,
  type SyncEntityName,
  type SyncError,
  type SyncSummary,
} from "@/types/sync";

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

export function useSyncDashboard() {
  const [summaries, setSummaries] = useState<SyncSummary[]>([]);
  const [batches, setBatches] = useState<SyncBatch[]>([]);
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [historyMeta, setHistoryMeta] = useState<PaginationMeta>(emptyMeta);
  const [errorsMeta, setErrorsMeta] = useState<PaginationMeta>(emptyMeta);
  const [selectedBatch, setSelectedBatch] = useState<SyncBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningEntity, setRunningEntity] = useState<SyncEntityName | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const refreshSummary = useCallback(async () => {
    const response = await syncService.getSummary();
    setSummaries(response.data || []);
  }, []);

  const refreshBatches = useCallback(async () => {
    const response = await syncService.listBatches({ page: 1, limit: 10 });
    setBatches(response.data || []);
    setHistoryMeta(response.meta || emptyMeta);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([refreshSummary(), refreshBatches()]);
    } finally {
      setLoading(false);
    }
  }, [refreshBatches, refreshSummary]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const runSync = useCallback(
    async (entityName: SyncEntityName, file: File) => {
      setRunningEntity(entityName);
      try {
        const response = await syncService.run(entityName, file);
        await refresh();
        return response.data;
      } finally {
        setRunningEntity(null);
      }
    },
    [refresh]
  );

  const loadErrors = useCallback(async (batch: SyncBatch) => {
    setSelectedBatch(batch);
    const response = await syncService.listErrors(batch.id, { page: 1, limit: 20 });
    setErrors(response.data || []);
    setErrorsMeta(response.meta || { ...emptyMeta, limit: 20 });
  }, []);

  const cleanup = useCallback(async () => {
    setCleaning(true);
    try {
      await syncService.cleanupDevelopmentData();
      await refresh();
      setSelectedBatch(null);
      setErrors([]);
    } finally {
      setCleaning(false);
    }
  }, [refresh]);

  return {
    summaries,
    batches,
    errors,
    historyMeta,
    errorsMeta,
    selectedBatch,
    loading,
    runningEntity,
    cleaning,
    refresh,
    runSync,
    loadErrors,
    cleanup,
  };
}

const ACTIVE_FAIR_STORAGE_KEY = "pegasus:fedequinas:active-fair:v1";
const LEGACY_ACTIVE_FAIR_STORAGE_KEY = "pegasus:fedequinas:active-fair";

function readActiveFairExternalId(): string | null {
  try {
    const storedFair =
      window.localStorage.getItem(ACTIVE_FAIR_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_ACTIVE_FAIR_STORAGE_KEY);
    const normalized = storedFair?.trim() || null;

    if (normalized && !window.localStorage.getItem(ACTIVE_FAIR_STORAGE_KEY)) {
      window.localStorage.setItem(ACTIVE_FAIR_STORAGE_KEY, normalized);
      window.localStorage.removeItem(LEGACY_ACTIVE_FAIR_STORAGE_KEY);
    }
    return normalized;
  } catch {
    return null;
  }
}

function persistActiveFairExternalId(fairExternalId: string | null): void {
  try {
    if (fairExternalId) {
      window.localStorage.setItem(ACTIVE_FAIR_STORAGE_KEY, fairExternalId);
    } else {
      window.localStorage.removeItem(ACTIVE_FAIR_STORAGE_KEY);
    }
    window.localStorage.removeItem(LEGACY_ACTIVE_FAIR_STORAGE_KEY);
  } catch {
    // La persistencia es una mejora progresiva; el flujo sigue activo en memoria.
  }
}

export type FedequinasSyncState = {
  activeFairExternalId: string | null;
  steps: FedequinasImportStep[];
  batches: SyncBatch[];
  knownFairExternalIds: string[];
  loading: boolean;
  error: string | null;
  announcement: string;
};

type FedequinasSyncEvent =
  | { type: "LOAD_START" }
  | {
      type: "LOAD_SUCCESS";
      batches: SyncBatch[];
      fairStatus: FedequinasFairStatus | null;
      activeFairExternalId: string | null;
    }
  | { type: "LOAD_FAILED"; message: string }
  | { type: "SELECT_FAIR"; fairExternalId: string | null }
  | { type: "FAIR_STATUS_LOADED"; fairStatus: FedequinasFairStatus }
  | { type: "FILE_SELECTED"; fileKind: FedequinasFileKind; file: File | null }
  | { type: "ANALYZE_STARTED"; fileKind: FedequinasFileKind }
  | {
      type: "PREVIEW_LOADED";
      fileKind: FedequinasFileKind;
      preview: NonNullable<FedequinasImportStep["preview"]>;
    }
  | { type: "PREVIEW_CLEARED"; fileKind: FedequinasFileKind }
  | { type: "APPLY_STARTED"; fileKind: FedequinasFileKind }
  | {
      type: "APPLY_COMPLETED";
      fileKind: FedequinasFileKind;
      batch: FedequinasStepBatch;
      hasWarnings: boolean;
    }
  | { type: "STEP_FAILED"; fileKind: FedequinasFileKind; message: string }
  | { type: "BATCHES_LOADED"; batches: SyncBatch[] };

function createEmptySteps(): FedequinasImportStep[] {
  return FEDEQUINAS_FILE_KINDS.map((fileKind, index) => ({
    fileKind,
    status: index === 0 ? "READY" : "LOCKED",
    file: null,
    preview: null,
    batch: null,
    error: null,
  }));
}

function mergeFairStatus(fairStatus: FedequinasFairStatus): FedequinasImportStep[] {
  return FEDEQUINAS_FILE_KINDS.map((fileKind, index) => {
    const remote = fairStatus.steps.find((step) => step.fileKind === fileKind);
    return {
      fileKind,
      status: remote?.status ?? (index === 0 ? "READY" : "LOCKED"),
      file: null,
      preview: null,
      batch: remote?.batch ?? null,
      error: null,
    };
  });
}

function knownFairs(batches: SyncBatch[]): string[] {
  return Array.from(
    new Set(
      batches
        .map((batch) => batch.fairExternalId)
        .filter((fairExternalId): fairExternalId is string => Boolean(fairExternalId))
    )
  );
}

const initialFedequinasState: FedequinasSyncState = {
  activeFairExternalId: null,
  steps: createEmptySteps(),
  batches: [],
  knownFairExternalIds: [],
  loading: true,
  error: null,
  announcement: "",
};

export function fedequinasSyncReducer(
  state: FedequinasSyncState,
  event: FedequinasSyncEvent
): FedequinasSyncState {
  switch (event.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return {
        ...state,
        loading: false,
        error: null,
        activeFairExternalId: event.activeFairExternalId,
        steps: event.fairStatus ? mergeFairStatus(event.fairStatus) : createEmptySteps(),
        batches: event.batches,
        knownFairExternalIds: knownFairs(event.batches),
      };
    case "LOAD_FAILED":
      return { ...state, loading: false, error: event.message };
    case "SELECT_FAIR":
      return {
        ...state,
        activeFairExternalId: event.fairExternalId,
        steps: createEmptySteps(),
        error: null,
        announcement: event.fairExternalId
          ? `Feria ${event.fairExternalId} seleccionada.`
          : "Selección de feria eliminada.",
      };
    case "FAIR_STATUS_LOADED":
      return {
        ...state,
        activeFairExternalId: event.fairStatus.fairExternalId,
        steps: mergeFairStatus(event.fairStatus),
        error: null,
        announcement: `Estado de la feria ${event.fairStatus.fairExternalId} actualizado.`,
      };
    case "FILE_SELECTED":
      return {
        ...state,
        steps: state.steps.map((step) =>
          step.fileKind === event.fileKind
            ? {
                ...step,
                file: event.file,
                preview: null,
                error: null,
                status: step.status === "LOCKED" ? "LOCKED" : "READY",
              }
            : step
        ),
      };
    case "ANALYZE_STARTED":
      return {
        ...state,
        steps: state.steps.map((step) =>
          step.fileKind === event.fileKind
            ? { ...step, status: "ANALYZING", error: null }
            : step
        ),
        announcement: "Analizando archivo.",
      };
    case "PREVIEW_LOADED":
      return {
        ...state,
        activeFairExternalId: event.preview.detectedFairExternalId,
        steps: state.steps.map((step) =>
          step.fileKind === event.fileKind
            ? { ...step, status: "PREVIEW", preview: event.preview, error: null }
            : step
        ),
        announcement: `Análisis listo: ${event.preview.counts.total} filas y ${event.preview.counts.errors} errores.`,
      };
    case "PREVIEW_CLEARED":
      return {
        ...state,
        steps: state.steps.map((step) =>
          step.fileKind === event.fileKind
            ? { ...step, status: "READY", file: null, preview: null, error: null }
            : step
        ),
        announcement: "Vista previa descartada.",
      };
    case "APPLY_STARTED":
      return {
        ...state,
        steps: state.steps.map((step) =>
          step.fileKind === event.fileKind
            ? { ...step, status: "APPLYING", error: null }
            : step
        ),
        announcement: "Aplicando importación. No cierres esta pestaña.",
      };
    case "APPLY_COMPLETED": {
      const completedIndex = FEDEQUINAS_FILE_KINDS.indexOf(event.fileKind);
      return {
        ...state,
        steps: state.steps.map((step, index) => {
          if (step.fileKind === event.fileKind) {
            return {
              ...step,
              status: event.hasWarnings ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
              batch: event.batch,
              preview: null,
              error: null,
            };
          }
          if (index === completedIndex + 1 && step.status === "LOCKED") {
            return { ...step, status: "READY" };
          }
          return step;
        }),
        announcement: event.hasWarnings
          ? "Importación completada con advertencias."
          : "Importación completada.",
      };
    }
    case "STEP_FAILED":
      return {
        ...state,
        steps: state.steps.map((step) =>
          step.fileKind === event.fileKind
            ? { ...step, status: "FAILED", error: event.message }
            : step
        ),
        announcement: `La importación falló: ${event.message}`,
      };
    case "BATCHES_LOADED":
      return {
        ...state,
        batches: event.batches,
        knownFairExternalIds: knownFairs(event.batches),
      };
    default: {
      const exhaustiveEvent: never = event;
      return exhaustiveEvent;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function requireData<T>(data: T | undefined, message: string): T {
  if (data === undefined) throw new Error(message);
  return data;
}

function toStepBatch(batch: SyncBatch): FedequinasStepBatch {
  return {
    id: batch.id,
    fileName: batch.fileName,
    checksum: batch.fileChecksum,
    startedAt: batch.startedAt,
    finishedAt: batch.finishedAt,
    counts: {
      total: batch.totalRows,
      inserts: batch.insertedRows,
      updates: batch.updatedRows,
      skips: batch.skippedRows,
      warnings: batch.warningRows ?? 0,
      errors: batch.failedRows,
    },
  };
}

export function canBeginFedequinasOperation(
  inFlight: ReadonlySet<FedequinasFileKind>,
  fileKind: FedequinasFileKind
): boolean {
  return !inFlight.has(fileKind);
}

export function useFedequinasSync() {
  const [state, dispatch] = useReducer(fedequinasSyncReducer, initialFedequinasState);
  const [cleaning, setCleaning] = useState(false);
  const inFlight = useRef(new Set<FedequinasFileKind>());
  const fairSelectionVersion = useRef(0);

  const loadBatches = useCallback(async () => {
    const response = await syncService.listBatches({ page: 1, limit: 50 });
    const batches = response.data || [];
    dispatch({ type: "BATCHES_LOADED", batches });
    return batches;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      dispatch({ type: "LOAD_START" });
      try {
        const storedFair = readActiveFairExternalId();
        const batchesRequest = syncService.listBatches({ page: 1, limit: 50 });
        const fairStatusRequest = storedFair
          ? syncService
              .getFedequinasFairStatus(storedFair)
              .then((response) =>
                requireData(response.data, "El servidor no devolvió el estado de la feria.")
              )
          : Promise.resolve(null);
        const [batchesResponse, fairStatus] = await Promise.all([
          batchesRequest,
          fairStatusRequest,
        ]);
        if (!cancelled) {
          dispatch({
            type: "LOAD_SUCCESS",
            batches: batchesResponse.data || [],
            fairStatus,
            activeFairExternalId: storedFair,
          });
        }
      } catch (error) {
        if (!cancelled) dispatch({ type: "LOAD_FAILED", message: errorMessage(error) });
      }
    }

    void loadInitialState();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectFair = useCallback(async (fairExternalId: string | null) => {
    const normalized = fairExternalId?.trim() || null;
    const selectionVersion = fairSelectionVersion.current + 1;
    fairSelectionVersion.current = selectionVersion;
    persistActiveFairExternalId(normalized);
    dispatch({ type: "SELECT_FAIR", fairExternalId: normalized });
    if (!normalized) return;

    try {
      const response = await syncService.getFedequinasFairStatus(normalized);
      if (selectionVersion !== fairSelectionVersion.current) return;
      dispatch({
        type: "FAIR_STATUS_LOADED",
        fairStatus: requireData(response.data, "El servidor no devolvió el estado de la feria."),
      });
    } catch (error) {
      if (selectionVersion !== fairSelectionVersion.current) return;
      dispatch({ type: "LOAD_FAILED", message: errorMessage(error) });
    }
  }, []);

  const selectFile = useCallback((fileKind: FedequinasFileKind, file: File | null) => {
    dispatch({ type: "FILE_SELECTED", fileKind, file });
  }, []);

  const analyze = useCallback(
    async (fileKind: FedequinasFileKind) => {
      if (!canBeginFedequinasOperation(inFlight.current, fileKind)) return;
      const step = state.steps.find((candidate) => candidate.fileKind === fileKind);
      if (!step?.file || step.status === "LOCKED") return;
      const selectionVersion = fairSelectionVersion.current;

      inFlight.current.add(fileKind);
      dispatch({ type: "ANALYZE_STARTED", fileKind });
      try {
        const response = await syncService.previewFedequinas(fileKind, step.file);
        const preview = requireData(
          response.data,
          "El servidor no devolvió la vista previa del archivo."
        );
        if (
          state.activeFairExternalId &&
          preview.detectedFairExternalId !== state.activeFairExternalId
        ) {
          throw new Error(
            `El archivo pertenece a la feria ${preview.detectedFairExternalId}, no a ${state.activeFairExternalId}.`
          );
        }
        if (selectionVersion !== fairSelectionVersion.current) return;
        persistActiveFairExternalId(preview.detectedFairExternalId);
        dispatch({ type: "PREVIEW_LOADED", fileKind, preview });
      } catch (error) {
        if (selectionVersion !== fairSelectionVersion.current) return;
        dispatch({ type: "STEP_FAILED", fileKind, message: errorMessage(error) });
        throw error;
      } finally {
        inFlight.current.delete(fileKind);
      }
    },
    [state.activeFairExternalId, state.steps]
  );

  const clearPreview = useCallback((fileKind: FedequinasFileKind) => {
    dispatch({ type: "PREVIEW_CLEARED", fileKind });
  }, []);

  const apply = useCallback(
    async (fileKind: FedequinasFileKind) => {
      if (!canBeginFedequinasOperation(inFlight.current, fileKind)) return false;
      const step = state.steps.find((candidate) => candidate.fileKind === fileKind);
      if (!step?.file || !step.preview || step.preview.counts.errors > 0) return false;
      const selectionVersion = fairSelectionVersion.current;

      inFlight.current.add(fileKind);
      dispatch({ type: "APPLY_STARTED", fileKind });
      try {
        const response = await syncService.applyFedequinas(
          fileKind,
          step.file,
          step.preview.previewToken,
          step.preview.checksum
        );
        const result = requireData(
          response.data,
          "El servidor no devolvió el resultado de la importación."
        );
        if (selectionVersion !== fairSelectionVersion.current) {
          await loadBatches();
          return true;
        }
        const batch = toStepBatch(result.batch);
        dispatch({
          type: "APPLY_COMPLETED",
          fileKind,
          batch,
          hasWarnings: result.result.counts.warnings > 0,
        });
        const fairStatusRequest = state.activeFairExternalId
          ? syncService
              .getFedequinasFairStatus(state.activeFairExternalId)
              .then((response) =>
                requireData(
                  response.data,
                  "El servidor no devolvió el estado actualizado de la feria."
                )
              )
          : Promise.resolve(null);
        const [, fairStatusResult] = await Promise.allSettled([
          loadBatches(),
          fairStatusRequest,
        ]);
        if (fairStatusResult.status === "fulfilled" && fairStatusResult.value) {
          dispatch({
            type: "FAIR_STATUS_LOADED",
            fairStatus: fairStatusResult.value,
          });
        }
        return true;
      } catch (error) {
        if (selectionVersion !== fairSelectionVersion.current) return false;
        dispatch({ type: "STEP_FAILED", fileKind, message: errorMessage(error) });
        throw error;
      } finally {
        inFlight.current.delete(fileKind);
      }
    },
    [loadBatches, state.activeFairExternalId, state.steps]
  );

  const cleanup = useCallback(async () => {
    setCleaning(true);
    try {
      await syncService.cleanupDevelopmentData();
      persistActiveFairExternalId(null);
      fairSelectionVersion.current += 1;
      const batches = await loadBatches();
      dispatch({
        type: "LOAD_SUCCESS",
        batches,
        fairStatus: null,
        activeFairExternalId: null,
      });
    } finally {
      setCleaning(false);
    }
  }, [loadBatches]);

  const filteredBatches = useMemo(
    () =>
      state.activeFairExternalId
        ? state.batches.filter((batch) => batch.fairExternalId === state.activeFairExternalId)
        : state.batches.filter((batch) => Boolean(batch.fairExternalId)),
    [state.activeFairExternalId, state.batches]
  );

  return {
    ...state,
    filteredBatches,
    cleaning,
    selectFair,
    selectFile,
    analyze,
    clearPreview,
    apply,
    cleanup,
  };
}
