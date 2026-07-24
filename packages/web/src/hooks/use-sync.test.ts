import { describe, expect, it } from "vitest";

import {
  canBeginFedequinasOperation,
  fedequinasSyncReducer,
  type FedequinasSyncState,
} from "@/hooks/use-sync";
import { FEDEQUINAS_FILE_KINDS, type FedequinasImportStep } from "@/types/sync";

function steps(): FedequinasImportStep[] {
  return FEDEQUINAS_FILE_KINDS.map((fileKind, index) => ({
    fileKind,
    status: index === 0 ? "READY" : "LOCKED",
    file: null,
    preview: null,
    batch: null,
    error: null,
  }));
}

function state(): FedequinasSyncState {
  return {
    activeFairExternalId: "FERIA-1",
    steps: steps(),
    batches: [],
    knownFairExternalIds: [],
    loading: false,
    error: null,
    announcement: "",
  };
}

describe("fedequinasSyncReducer", () => {
  it("activa la feria detectada y conserva la vista previa", () => {
    const preview = {
      checksum: "checksum",
      previewToken: "preview-token",
      detectedFairExternalId: "FERIA-2",
      headers: ["ID_FERIA"],
      counts: { total: 2, inserts: 1, updates: 0, skips: 1, warnings: 1, errors: 0 },
      issues: [
        {
          severity: "warning" as const,
          row: 2,
          code: "ROW_WARNING",
          message: "Advertencia de prueba.",
        },
      ],
    };

    const previewed = fedequinasSyncReducer(
      { ...state(), activeFairExternalId: null },
      { type: "PREVIEW_LOADED", fileKind: "FEH_FERIAS", preview }
    );

    expect(previewed.activeFairExternalId).toBe("FERIA-2");
    expect(previewed.steps[0]).toMatchObject({ status: "PREVIEW", preview });
    expect(previewed.announcement).toContain("2 filas");
  });

  it("marca la aplicación y desbloquea el siguiente paso al completar", () => {
    const applying = fedequinasSyncReducer(state(), {
      type: "APPLY_STARTED",
      fileKind: "FEH_FERIAS",
    });
    expect(applying.steps[0].status).toBe("APPLYING");

    const completed = fedequinasSyncReducer(applying, {
      type: "APPLY_COMPLETED",
      fileKind: "FEH_FERIAS",
      hasWarnings: false,
      batch: {
        id: "batch-1",
        fileName: "feria.xlsx",
        checksum: "checksum",
        startedAt: "2026-07-23T20:00:00.000Z",
        finishedAt: "2026-07-23T20:01:00.000Z",
        counts: { total: 1, inserts: 1, updates: 0, skips: 0, warnings: 0, errors: 0 },
      },
    });

    expect(completed.steps[0].status).toBe("COMPLETED");
    expect(completed.steps[1].status).toBe("READY");
  });

  it("bloquea un segundo envío del mismo paso mientras está en curso", () => {
    const inFlight = new Set([FEDEQUINAS_FILE_KINDS[0]]);

    expect(canBeginFedequinasOperation(inFlight, "FEH_FERIAS")).toBe(false);
    expect(canBeginFedequinasOperation(inFlight, "FEH_PERSONAL_FERIA")).toBe(true);
  });

  it("recorre análisis, error y reintento sin desbloquear pasos fuera de orden", () => {
    const analyzing = fedequinasSyncReducer(state(), {
      type: "ANALYZE_STARTED",
      fileKind: "FEH_FERIAS",
    });
    expect(analyzing.steps.map((step) => step.status)).toEqual([
      "ANALYZING",
      "LOCKED",
      "LOCKED",
      "LOCKED",
    ]);

    const failed = fedequinasSyncReducer(analyzing, {
      type: "STEP_FAILED",
      fileKind: "FEH_FERIAS",
      message: "Error recuperable",
    });
    expect(failed.steps[0]).toMatchObject({
      status: "FAILED",
      error: "Error recuperable",
    });

    const file = new File(["xlsx"], "feria.xlsx");
    const selectedAgain = fedequinasSyncReducer(failed, {
      type: "FILE_SELECTED",
      fileKind: "FEH_FERIAS",
      file,
    });
    expect(selectedAgain.steps[0]).toMatchObject({
      status: "READY",
      file,
      error: null,
    });

    const retried = fedequinasSyncReducer(selectedAgain, {
      type: "ANALYZE_STARTED",
      fileKind: "FEH_FERIAS",
    });
    expect(retried.steps[0].status).toBe("ANALYZING");
    expect(retried.steps[1].status).toBe("LOCKED");
  });

  it("representa completado con advertencias y permite reanalizarlo", () => {
    const completed = fedequinasSyncReducer(state(), {
      type: "APPLY_COMPLETED",
      fileKind: "FEH_FERIAS",
      hasWarnings: true,
      batch: {
        id: "batch-warning",
        fileName: "feria.xlsx",
        checksum: "checksum",
        startedAt: "2026-07-23T20:00:00.000Z",
        finishedAt: "2026-07-23T20:01:00.000Z",
        counts: { total: 1, inserts: 1, updates: 0, skips: 0, warnings: 1, errors: 0 },
      },
    });
    expect(completed.steps[0].status).toBe("COMPLETED_WITH_WARNINGS");
    expect(completed.steps[1].status).toBe("READY");

    const replacement = new File(["xlsx"], "feria-corregida.xlsx");
    const selected = fedequinasSyncReducer(completed, {
      type: "FILE_SELECTED",
      fileKind: "FEH_FERIAS",
      file: replacement,
    });
    expect(selected.steps[0]).toMatchObject({
      status: "READY",
      file: replacement,
      preview: null,
    });
  });
});
